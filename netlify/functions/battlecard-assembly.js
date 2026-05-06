const { createClient } = require('@supabase/supabase-js');

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function respond(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

exports.handler = async function(event, context) {

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return respond(400, { error: "Invalid JSON body" });
  }

  const { mode, productId, competitorId, sessionId, userId } = body;

  async function saveSession(sessionId, state) {
    const { error } = await supabase
      .from('analyst_sessions')
      .upsert({
        session_id: sessionId,
        report_type: 'battlecard_assembly',
        state: JSON.stringify(state),
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id' });
    if (error) throw new Error(`Session save failed: ${JSON.stringify(error)}`);
  }

  async function loadSession(sessionId) {
    const { data, error } = await supabase
      .from('analyst_sessions')
      .select('state')
      .eq('session_id', sessionId)
      .single();
    if (error) throw new Error(`Session load failed: ${JSON.stringify(error)}`);
    if (!data) throw new Error(`Session not found: ${sessionId}`);
    return JSON.parse(data.state);
  }

  try {

    // ─────────────────────────────────────────────
    // MODE: create_scoring_job
    // Triggers async use case scoring
    // ─────────────────────────────────────────────
    if (mode === "create_scoring_job") {
      const job_id = `scoring_${competitorId}_${Date.now()}`;

      // Initialize session
      await saveSession(sessionId, {
        step: 'awaiting_scoring',
        productId,
        competitorId,
        scoringJobId: job_id,
        confirmedScores: null,
        swotJobId: null,
        confirmedSwot: null
      });

      // Create job row
      await supabase.from('research_results').insert({
        job_id,
        mode: 'battlecard_scoring',
        competitor: competitorId,
        product_name: productId,
        status: 'pending'
      });

      // Trigger background function
      await fetch(`${process.env.URL}/.netlify/functions/battlecard-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id, jobType: 'scoring', productId, competitorId })
      });

      return respond(200, {
        job_id,
        sessionId,
        status: 'pending',
        message: 'Use case scoring job created. Poll /research-status with job_id to check progress.'
      });
    }

    // ─────────────────────────────────────────────
    // MODE: confirm_use_case_scores
    // PMM has reviewed and confirmed scores
    // ─────────────────────────────────────────────
    if (mode === "confirm_use_case_scores") {
      const { confirmedScores } = body;
      const session = await loadSession(sessionId);

      session.confirmedScores = confirmedScores;
      session.step = 'scores_confirmed';
      await saveSession(sessionId, session);

      return respond(200, {
        sessionId,
        step: 'scores_confirmed',
        message: `Use case scores confirmed for ${confirmedScores.length} use cases. Ready to generate SWOT analysis.`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: create_swot_job
    // Triggers async SWOT generation
    // ─────────────────────────────────────────────
    if (mode === "create_swot_job") {
      const session = await loadSession(sessionId);
      const job_id = `swot_${competitorId}_${Date.now()}`;

      session.swotJobId = job_id;
      session.step = 'awaiting_swot';
      await saveSession(sessionId, session);

      // Create job row
      await supabase.from('research_results').insert({
        job_id,
        mode: 'battlecard_swot',
        competitor: competitorId,
        product_name: productId,
        status: 'pending'
      });

      // Trigger background function
      await fetch(`${process.env.URL}/.netlify/functions/battlecard-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id, jobType: 'swot', productId, competitorId })
      });

      return respond(200, {
        job_id,
        sessionId,
        status: 'pending',
        message: 'SWOT generation job created. Poll /research-status with job_id to check progress.'
      });
    }

    // ─────────────────────────────────────────────
    // MODE: confirm_swot
    // PMM has reviewed and confirmed SWOT
    // ─────────────────────────────────────────────
    if (mode === "confirm_swot") {
      const { confirmedSwot } = body;
      const session = await loadSession(sessionId);

      session.confirmedSwot = confirmedSwot;
      session.step = 'swot_confirmed';
      await saveSession(sessionId, session);

      return respond(200, {
        sessionId,
        step: 'swot_confirmed',
        message: 'SWOT confirmed. Ready to assemble the battlecard.'
      });
    }

    // ─────────────────────────────────────────────
    // MODE: assemble_battlecard
    // Combines all confirmed data into template JSON
    // Saves to battlecard_versions
    // Returns populated template data
    // ─────────────────────────────────────────────
    if (mode === "assemble_battlecard") {
      const { changeReason } = body;

      // Load scoring data directly from research_results
      const { data: scoringRow } = await supabase
        .from('research_results')
        .select('result')
        .eq('competitor_id', competitorId)
        .eq('product_name', productId)
        .eq('mode', 'battlecard_scoring')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!scoringRow) return respond(400, { error: "Use case scores not found. Run scoring first." });

      // Load SWOT data directly from research_results
      const { data: swotRow } = await supabase
        .from('research_results')
        .select('result')
        .eq('competitor_id', competitorId)
        .eq('product_name', productId)
        .eq('mode', 'battlecard_swot')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!swotRow) return respond(400, { error: "SWOT not found. Run SWOT generation first." });

      const scoringData = typeof scoringRow.result === 'string' ? JSON.parse(scoringRow.result) : scoringRow.result;
      const swotData = typeof swotRow.result === 'string' ? JSON.parse(swotRow.result) : swotRow.result;
	  
      // Load all data needed for assembly
      const { data: product } = await supabase
        .from('user_products').select('*').eq('id', productId).single();

      const { data: competitor } = await supabase
        .from('competitor_profiles').select('*').eq('id', competitorId).single();

      // Load analyst data
      const { data: gartnerResults } = await supabase
        .from('research_results')
        .select('*')
        .eq('competitor_id', competitorId)
        .eq('mode', 'analyst_gartner')
        .eq('status', 'complete');

      const { data: forresterResults } = await supabase
        .from('research_results')
        .select('*')
        .eq('competitor_id', competitorId)
        .eq('mode', 'analyst_forrester')
        .eq('status', 'complete');

      // Load website research
      const { data: websiteData } = await supabase
        .from('research_results')
        .select('result')
        .eq('competitor_id', competitorId)
        .eq('mode', 'research_website')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1);

      const websiteResult = websiteData?.[0]?.result || '';

      // Load review data
      const { data: reviewResults } = await supabase
        .from('research_results')
        .select('*')
        .eq('competitor_id', competitorId)
        .in('mode', ['research_g2', 'research_trustradius', 'research_gartner_peers'])
        .eq('status', 'complete');

      // Load FUD candidates
      const { data: fudRow } = await supabase
        .from('research_results')
        .select('result')
        .eq('competitor_id', competitorId)
        .eq('mode', 'fud_analysis')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const fudResult = fudRow?.result
        ? (typeof fudRow.result === 'string' ? JSON.parse(fudRow.result) : fudRow.result)
        : { fud_candidates: [] };

      const fudCandidates = fudResult.fud_candidates || [];

      // Build analyst placements and bullets
      const analystPlacements = [];
      const analystStrengths = [];
      const analystCautions = [];
      const analystSources = [];

      gartnerResults?.forEach(r => {
        try {
          const p = JSON.parse(r.result);
          analystPlacements.push({
            label: p.mq_quadrant,
            source: `Gartner MQ ${p.mq_name} ${p.mq_year}`
          });
          if (p.strength_1_label) analystStrengths.push(p.strength_1_label);
          if (p.strength_2_label) analystStrengths.push(p.strength_2_label);
          if (p.strength_3_label) analystStrengths.push(p.strength_3_label);
          if (p.caution_1_label) analystCautions.push(p.caution_1_label);
          if (p.caution_2_label) analystCautions.push(p.caution_2_label);
          if (p.caution_3_label) analystCautions.push(p.caution_3_label);
          analystSources.push({ label: `Gartner MQ ${p.mq_year}`, href: '#' });
        } catch(e) {}
      });

      forresterResults?.forEach(r => {
        try {
          const p = JSON.parse(r.result);
          analystPlacements.push({
            label: p.wave_placement,
            source: `Forrester Wave ${p.wave_name} ${p.wave_year}`
          });
          analystSources.push({ label: `Forrester Wave ${p.wave_year}`, href: '#' });
        } catch(e) {}
      });

      // Build customer ratings and themes
      const customerRatings = [];
      const customerPraise = [];
      const customerComplaints = [];

      const seenPlatforms = new Set();
      reviewResults?.forEach(r => {
        try {
          const platform = r.mode.replace('research_', '').replace('gartner_peers', 'Gartner Peer Insights').toUpperCase();
          if (seenPlatforms.has(platform)) return;
          seenPlatforms.add(platform);

          // Extract rating
          const ratingMatch = r.result.match(/(\d+\.?\d*)\s*(?:out of\s*)?\/\s*(?:5|10)/i);
          if (ratingMatch) {
            customerRatings.push({ label: platform, value: `${ratingMatch[1]} / 5`, n: '' });
          }

          // Extract praise themes — look for numbered praise sections
          const praiseSection = r.result.match(/praise|strength|positive|pros?|what.*like/i);
          if (praiseSection) {
            // Extract bullet points or numbered items after praise heading
            const lines = r.result.split('\n');
            let inPraise = false;
            let praiseCount = 0;
            for (const line of lines) {
              if (/###.*(?:praise|positive|strength)|top\s+\d+\s+praise/i.test(line)) { inPraise = true; continue; }
              if (/^\d+\.\s+[🏆⚡📉✅]|^###\s+\d+\./i.test(line)) { inPraise = true; continue; }
              if (inPraise && /complaint|weakness|negative|cons?|concern/i.test(line)) { inPraise = false; }
              if (inPraise && praiseCount < 3) {
                const cleaned = line.replace(/^[\s\-\*\d\.\#]+/, '').trim();
                if (cleaned.length > 20 && cleaned.length < 200 && !cleaned.startsWith('>') && !cleaned.startsWith('"') && !cleaned.includes('Representative Quote')) {
                  customerPraise.push(cleaned);
                  praiseCount++;
                }
              }
            }
          }

          // Extract complaint themes
          const complaintSection = r.result.match(/complaint|weakness|negative|cons?|concern|criticis/i);
          if (complaintSection) {
            const lines = r.result.split('\n');
            let inComplaint = false;
            let complaintCount = 0;
            for (const line of lines) {
              if (/###.*(?:complaint|negative|weak)|top\s+\d+\s+complaint/i.test(line)) { inComplaint = true; continue; }
              if (/^❌|^###\s+\d+\.\s+[📈🐢💸🔀]/i.test(line)) { inComplaint = true; continue; }
              if (inComplaint && /praise|strength|positive|pros?:/i.test(line)) { inComplaint = false; }
              if (inComplaint && complaintCount < 3) {
                const cleaned = line.replace(/^[\s\-\*\d\.\#]+/, '').trim();
                if (cleaned.length > 20 && cleaned.length < 200 && !cleaned.startsWith('>') && !cleaned.startsWith('"') && !cleaned.includes('Representative Quote')) {
                  customerComplaints.push(cleaned);
                  complaintCount++;
                }
              }
            }
          }
        } catch(e) {}
      });

      // Build FUD sections for Tab 3
      const fudBySignal = {
        strong: fudCandidates?.filter(f => f.signal_strength === 'Strong') || [],
        moderate: fudCandidates?.filter(f => f.signal_strength === 'Moderate') || []
      };

      const tab3Sections = [];

      if (fudBySignal.strong.length > 0) {
        tab3Sections.push({
          key: 'negative_analyst',
          title: 'Primary FUD — High Confidence',
          items: fudBySignal.strong.map(f => ({
            intelligence: f.weakness_summary,
            intel_sources: [{ label: f.source, href: '#' }],
            discovery_question: f.discovery_question,
            recommended_response: f.proof_point || '[PMM to complete]',
            priority: 'high',
            priority_label: 'Strength match'
          }))
        });
      }

      if (fudBySignal.moderate.length > 0) {
        tab3Sections.push({
          key: 'negative_reviews',
          title: 'Secondary FUD — Moderate Confidence',
          items: fudBySignal.moderate.map(f => ({
            intelligence: f.weakness_summary,
            intel_sources: [{ label: f.source, href: '#' }],
            discovery_question: f.discovery_question,
            recommended_response: f.proof_point || '[PMM to complete]',
            priority: 'medium',
            priority_label: 'Context match'
          }))
        });
      }

      // Build the complete template JSON
      const battlecardData = {
        header: {
          our_product_name: product.product_name,
          competitor_name: competitor.product_name.toLowerCase().includes(competitor.company_name.toLowerCase())
            ? competitor.product_name
            : `${competitor.company_name} ${competitor.product_name}`,
          deck_subtitle: `Competitive intelligence for ${competitor.company_name} ${competitor.product_name} deals`,
          publish_date: new Date().toISOString().split('T')[0],
          refresh_cadence: 'Monthly',
          pmm_owner: 'PMM Team',
          staleness: 'CURRENT',
          cta_link: 'mailto:pmm@company.com',
          our_product_short: product.product_name.substring(0, 12),
          competitor_short: competitor.company_name.substring(0, 12)
        },
        tab1_use_cases: scoringData.scored_use_cases || scoringData,
        tab2: {
          overview: [
            {
              label: 'Product Name',
              value: `${competitor.company_name} ${competitor.product_name}`,
              sources: [{ label: 'Competitor website', href: '#' }],
              accessed: new Date().toISOString().split('T')[0]
            },
            {
              label: 'Ideal Customer Profile',
              value: (() => {
                const sectionMatch = websiteResult.match(/##[^#\n]*(?:ideal customer|icp|target(?:ed)? customer)[^\n]*\n([\s\S]{20,600}?)(?=\n##|\n---|\z)/i);
                if (sectionMatch) {
                  const lines = sectionMatch[1].split('\n').map(l => l.replace(/^[\s\*\#\-]+/, '').trim()).filter(l => l.length > 15 && !l.startsWith('Source') && !l.startsWith('http'));
                  if (lines.length > 0) return lines.slice(0, 3).join(' ');
                }
                return competitor.icp || competitor.target_customer_size || 'See research results';
              })(),
              sources: websiteResult ? [{ label: 'Competitor website', href: '#' }] : [],
              accessed: new Date().toISOString().split('T')[0]
            },
            {
              label: 'Core Messaging',
              value: (() => {
                const sectionMatch = websiteResult.match(/##[^#\n]*(?:value proposition|tagline|positioning|messaging)[^\n]*\n([\s\S]{20,400}?)(?=\n##|\n---)/i);
                if (sectionMatch) {
                  const lines = sectionMatch[1].split('\n').map(l => l.replace(/^[\s\*\#\-]+/, '').trim()).filter(l => l.length > 15 && !l.startsWith('Source') && !l.startsWith('http'));
                  if (lines.length > 0) return lines[0].replace(/\*+/g, '').trim();
                }
                const boldMatch = websiteResult.match(/\*\*[""]([^""]{20,300})[""]\*\*/);
                return boldMatch ? boldMatch[1] : (competitor.positioning || 'See research results');
              })(),
              sources: websiteResult ? [{ label: 'Competitor website', href: '#' }] : [],
              accessed: new Date().toISOString().split('T')[0]
            },
            {
              label: 'Self-Proclaimed Strengths',
              value: (() => {
                const sectionMatch = websiteResult.match(/##[^#\n]*(?:strength|differentiator)[^\n]*\n([\s\S]{20,800}?)(?=\n##|\n---)/i);
                if (sectionMatch) {
                  const subheadings = sectionMatch[1].match(/###[^\n]+/g);
                  if (subheadings && subheadings.length > 0) {
                    return subheadings.slice(0, 3).map(s => s.replace(/^###\s*/, '').trim()).join(' · ');
                  }
                  const lines = sectionMatch[1].split('\n').map(l => l.replace(/^[\s\*\#\-]+/, '').trim()).filter(l => l.length > 15 && !l.startsWith('Source') && !l.startsWith('http'));
                  return lines.slice(0, 3).join(' · ') || (competitor.known_strengths || 'See research results');
                }
                return competitor.known_strengths || 'See research results';
              })(),
              sources: websiteResult ? [{ label: 'Competitor website', href: '#' }] : [],
              accessed: new Date().toISOString().split('T')[0]
            },
            {
              label: 'Known Pricing & Packaging',
              value: (() => {
                const sectionMatch = websiteResult.match(/##[^#\n]*(?:pricing|packaging|price)[^\n]*\n([\s\S]{20,800}?)(?=\n##|\n---)/i);
                if (sectionMatch) {
                  const lines = sectionMatch[1].split('\n').map(l => l.replace(/^[\s\*\#\-]+/, '').trim()).filter(l => l.length > 15 && !l.startsWith('Source') && !l.startsWith('http') && !l.startsWith('**Source'));
                  if (lines.length > 0) return lines.slice(0, 3).join(' ');
                }
                return competitor.pricing_notes || 'Not publicly disclosed';
              })(),
              sources: websiteResult ? [{ label: 'Competitor website', href: '#' }] : [],
              accessed: new Date().toISOString().split('T')[0]
            }
          ],
          analyst: {
            placements: analystPlacements,
            strengths: analystStrengths.slice(0, 3),
            cautions: analystCautions.slice(0, 3),
            sources: analystSources
          },
          customer: {
            ratings: customerRatings,
            praise: customerPraise.length > 0 ? customerPraise : ['See review research for detailed themes'],
            complaints: customerComplaints.length > 0 ? customerComplaints : ['See review research for detailed themes']
          },
          swot: swotData.swot || swotData
        },
        tab3_fud_sections: tab3Sections
      };

      // Check if battlecard exists for this pair
      const { data: existingCard } = await supabase
        .from('battlecards')
        .select('*')
        .eq('product_id', productId)
        .eq('competitor_id', competitorId)
        .single();

      let battlecardId;

      if (existingCard) {
        // Archive current version
        await supabase.from('battlecard_versions').insert({
          battlecard_id: existingCard.id,
          version_number: existingCard.current_version,
          tab_use_case: battlecardData.tab1_use_cases,
          tab_critical_intelligence: { ...battlecardData.tab2, header: battlecardData.header },
          tab_fud: battlecardData.tab3_fud_sections,
          change_reason: changeReason || 'Battlecard updated',
          changed_by: userId || null,
          changed_at: new Date().toISOString()
        });

        // Update battlecard
        await supabase
          .from('battlecards')
          .update({
            current_version: existingCard.current_version + 1,
            status: 'published',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCard.id);

        battlecardId = existingCard.id;
      } else {
        // Create new battlecard
        const { data: newCard, error: insertCardError } = await supabase
          .from('battlecards')
          .insert({
            product_id: productId,
            competitor_id: competitorId,
            status: 'published',
            current_version: 1,
            created_by: userId || null
          })
          .select()
          .single();

        if (insertCardError || !newCard) {
          throw new Error(`Failed to create battlecard: ${JSON.stringify(insertCardError)}`);
        }

        // Save first version
        await supabase.from('battlecard_versions').insert({
          battlecard_id: newCard.id,
          version_number: 1,
          tab_use_case: battlecardData.tab1_use_cases,
          tab_critical_intelligence: { ...battlecardData.tab2, header: battlecardData.header },
          tab_fud: battlecardData.tab3_fud_sections,
          change_reason: changeReason || 'Initial battlecard creation',
          changed_by: userId || null,
          changed_at: new Date().toISOString()
        });

        battlecardId = newCard.id;
      }

      // Clean up session
      await supabase
        .from('analyst_sessions')
        .delete()
        .eq('session_id', sessionId);

      return respond(200, {
        mode: 'battlecard_assembled',
        battlecardId,
        battlecardData,
        message: `Battlecard assembled for **${product.product_name} vs ${competitor.company_name} ${competitor.product_name}**.\n\nAll three tabs populated and saved to database.`
      });
    }
// ─────────────────────────────────────────────
    // MODE: get_battlecard
    // Returns battlecard data for the viewer
    // ─────────────────────────────────────────────
    if (mode === "get_battlecard") {
      const { battlecardId } = body;

      const { data: version, error } = await supabase
        .from('battlecard_versions')
        .select('*')
        .eq('battlecard_id', battlecardId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (error || !version) {
        return respond(404, { error: "Battlecard not found" });
      }

      return respond(200, {
        battlecardId,
        versionNumber: version.version_number,
        tab_use_case: version.tab_use_case,
        tab_critical_intelligence: version.tab_critical_intelligence,
        tab_fud: version.tab_fud,
        changed_at: version.changed_at
      });
    }
    return respond(400, {
      error: "Invalid mode. Use: create_scoring_job, confirm_use_case_scores, create_swot_job, confirm_swot, assemble_battlecard"
    });

  } catch (error) {
    return respond(200, {
      debug_error: error.message,
      debug_stack: error.stack,
      debug_mode: body ? body.mode : "unknown"
    });
  }
};