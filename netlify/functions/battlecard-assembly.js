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
      const session = await loadSession(sessionId);

      if (!session.confirmedScores) return respond(400, { error: "Use case scores not confirmed yet" });
      if (!session.confirmedSwot) return respond(400, { error: "SWOT not confirmed yet" });

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

      // Load review data
      const { data: reviewResults } = await supabase
        .from('research_results')
        .select('*')
        .eq('competitor_id', competitorId)
        .in('mode', ['research_g2', 'research_trustradius', 'research_gartner_peers'])
        .eq('status', 'complete');

      // Load FUD candidates
      const { data: fudCandidates } = await supabase
        .from('fud_candidates')
        .select('*')
        .eq('product_id', productId)
        .eq('competitor_id', competitorId)
        .eq('status', 'active')
        .order('signal_strength', { ascending: false });

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

      reviewResults?.forEach(r => {
        try {
          const platform = r.mode.replace('research_', '').toUpperCase();
          // Extract rating if present in result text
          const ratingMatch = r.result.match(/(\d+\.?\d*)\s*\/\s*5/);
          if (ratingMatch) {
            customerRatings.push({
              label: platform,
              value: `${ratingMatch[1]} / 5`,
              n: ''
            });
          }
          // Extract praise and complaint themes (simplified)
          if (r.result.includes('praise') || r.result.includes('Praise') || r.result.includes('PRAISE')) {
            customerPraise.push(`${platform}: See research results`);
          }
          if (r.result.includes('complaint') || r.result.includes('Complaint')) {
            customerComplaints.push(`${platform}: See research results`);
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
          competitor_name: `${competitor.company_name} ${competitor.product_name}`,
          deck_subtitle: `Competitive intelligence for ${competitor.company_name} ${competitor.product_name} deals`,
          publish_date: new Date().toISOString().split('T')[0],
          refresh_cadence: 'Monthly',
          pmm_owner: 'PMM Team',
          staleness: 'CURRENT',
          cta_link: 'mailto:pmm@company.com',
          our_product_short: product.product_name.substring(0, 12),
          competitor_short: competitor.company_name.substring(0, 12)
        },
        tab1_use_cases: session.confirmedScores,
        tab2: {
          overview: [
            {
              label: 'Product Name',
              value: `${competitor.company_name} ${competitor.product_name}`,
              sources: [{ label: 'Competitor website', href: '#' }],
              accessed: new Date().toISOString().split('T')[0]
            },
            {
              label: 'Target Customer',
              value: competitor.target_customer_size || 'See profile',
              sources: [],
              accessed: new Date().toISOString().split('T')[0]
            },
            {
              label: 'Geographic Focus',
              value: competitor.geographic_focus || 'See profile',
              sources: [],
              accessed: new Date().toISOString().split('T')[0]
            },
            {
              label: 'Target Industries',
              value: competitor.target_industries || 'See profile',
              sources: [],
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
          swot: session.confirmedSwot
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
          tab_critical_intelligence: battlecardData.tab2,
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