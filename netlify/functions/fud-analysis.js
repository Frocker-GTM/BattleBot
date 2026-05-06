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

  const { mode, productId, competitorId, userId, changeReason } = body;

  async function callClaude(systemPrompt, userMessage) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data.content[0].text;
  }

  try {

    // ─────────────────────────────────────────────
    // MODE: run_analysis
    // Takes productId + competitorId
    // Pulls all data from Supabase
    // Runs weighted gap analysis
    // Returns ranked FUD candidates for PMM review
    // ─────────────────────────────────────────────
    if (mode === "run_analysis") {

      // Step 1: Load your product profile
      const { data: product, error: productError } = await supabase
        .from('user_products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        return respond(400, { error: `Product not found: ${JSON.stringify(productError)}` });
      }

      // Step 2: Load competitor profile
      const { data: competitor, error: competitorError } = await supabase
        .from('competitor_profiles')
        .select('*')
        .eq('id', competitorId)
        .single();

      if (competitorError || !competitor) {
        return respond(400, { error: `Competitor not found: ${JSON.stringify(competitorError)}` });
      }

      // Step 3: Load all research results for this competitor
      const { data: researchResults } = await supabase
        .from('research_results')
        .select('*')
        .eq('competitor_id', competitorId)
        .eq('status', 'complete');

      // Step 4: Load analyst extractions for this competitor
      const { data: analystResults } = await supabase
        .from('research_results')
        .select('*')
        .eq('competitor_id', competitorId)
        .in('mode', ['analyst_forrester', 'analyst_gartner'])
        .eq('status', 'complete');

      // Step 5: Load field notes for this competitor
      const { data: fieldNotes } = await supabase
        .from('field_notes')
        .select('*')
        .eq('competitor_id', competitorId);

      // Step 6: Load existing FUD candidates for versioning
      const { data: existingFUD } = await supabase
        .from('fud_candidates')
        .select('*')
        .eq('product_id', productId)
        .eq('competitor_id', competitorId)
        .eq('status', 'active');

      // Organize research by type
      const reviewData = researchResults?.filter(r =>
        ['research_g2', 'research_trustradius', 'research_gartner_peers'].includes(r.mode)
      ) || [];

      const websiteData = researchResults?.filter(r =>
        r.mode === 'research_website'
      ) || [];

      const forresterData = analystResults?.filter(r =>
        r.mode === 'analyst_forrester'
      ) || [];

      const gartnerData = analystResults?.filter(r =>
        r.mode === 'analyst_gartner'
      ) || [];

      // Build data summary for Claude
      const reviewSummary = reviewData.map(r => `
SOURCE: ${r.mode.replace('research_', '').toUpperCase()} Reviews
${r.result}
`).join('\n---\n');

      const websiteSummary = websiteData.map(r => `
SOURCE: Competitor Website
${r.result}
`).join('\n---\n');

      const forresterSummary = forresterData.map(r => {
        try {
          const parsed = JSON.parse(r.result);
          return `
SOURCE: Forrester Wave (${parsed.wave_name} ${parsed.wave_quarter} ${parsed.wave_year})
Placement: ${parsed.wave_placement}
Customer Feedback Halo: ${parsed.customer_feedback_halo}
Current Offering Composite: ${parsed.current_offering_composite}
Strategy Composite: ${parsed.strategy_composite}
Criteria scoring 1 (below par): ${parsed.criteria?.filter(c => c.score === 1).map(c => c.name).join(', ') || 'None'}
Capabilities: ${parsed.capabilities_narrative}
Customer Feedback: ${parsed.customer_feedback_narrative}
PMM Context on Capabilities: ${parsed.pmm_context?.capabilities_narrative || 'None'}
PMM Context on Customer Feedback: ${parsed.pmm_context?.customer_feedback_narrative || 'None'}
Existing FUD from extraction: ${parsed.fud_candidates?.map(f => f.weakness_summary).join('; ') || 'None'}
PMM Confidence Score: ${parsed.pmm_confidence_score}/5
`;
        } catch(e) { return r.result; }
      }).join('\n---\n');

      const gartnerSummary = gartnerData.map(r => {
        try {
          const parsed = JSON.parse(r.result);
          return `
SOURCE: Gartner MQ (${parsed.mq_name} ${parsed.mq_month} ${parsed.mq_year})
Quadrant: ${parsed.mq_quadrant}
Vision Position: ${parsed.vision_axis_position}
Execution Position: ${parsed.execution_axis_position}
Caution 1: ${parsed.caution_1_label} — ${parsed.caution_1_paragraph}
PMM Context on Caution 1: ${parsed.pmm_context?.caution_1?.response || 'None'}
Caution 2: ${parsed.caution_2_label} — ${parsed.caution_2_paragraph}
PMM Context on Caution 2: ${parsed.pmm_context?.caution_2?.response || 'None'}
Caution 3: ${parsed.caution_3_label} — ${parsed.caution_3_paragraph}
PMM Context on Caution 3: ${parsed.pmm_context?.caution_3?.response || 'None'}
Existing FUD from extraction: ${parsed.fud_candidates?.map(f => f.weakness_summary).join('; ') || 'None'}
PMM Confidence Score: ${parsed.pmm_confidence_score}/5
`;
        } catch(e) { return r.result; }
      }).join('\n---\n');

      const fieldNotesSummary = fieldNotes?.map(n =>
        `[${n.note_type?.toUpperCase() || 'NOTE'}] ${n.note}${n.deal_context ? ` (Deal context: ${n.deal_context})` : ''}`
      ).join('\n') || 'None';

      // Build the analysis prompt
      const systemPrompt = `You are a senior competitive intelligence analyst building a FUD analysis for a B2B sales team.

YOUR PRODUCT:
Name: ${product.product_name}
Category: ${product.category}
ICP: ${product.icp}
Key Strengths: ${product.strengths}
Key Differentiators: ${product.key_differentiators}
Use Cases: ${JSON.stringify(product.use_cases)}
Positioning: ${product.positioning}

COMPETITOR:
Company: ${competitor.company_name}
Product: ${competitor.product_name}
Category: ${competitor.category}
Known Weaknesses: ${competitor.known_weaknesses || 'See research data below'}

SOURCE WEIGHTING (apply in this order):
1. Aggregate review data (G2, TrustRadius, Gartner Peer Insights) — HIGHEST weight — real users at scale
2. Forrester customer feedback narrative — HIGH weight — expert-filtered user voice
3. Gartner MQ Cautions confirmed by PMM — MEDIUM-HIGH weight
4. Forrester criterion scores × confidence score — MEDIUM weight
5. Competitor website claims — LOW weight — self-reported
6. Individual review quotes — LOWEST — color only

FUD FLAGGING RULES:
- A competitor weakness that YOUR product directly addresses = Strong FUD signal
- PMM-confirmed weakness = elevate priority
- Weakness corroborated by multiple sources = elevate priority
- Weakness that competitor has already addressed = deprioritize
- Commodity capability where all vendors struggle = not a differentiator
- Competitor strength that overlaps with yours = flag as competitive overlap, NOT FUD

OUTPUT FORMAT:
Return a JSON object with two arrays:

{
  "fud_candidates": [
    {
      "source": "source name e.g. G2 Reviews / Gartner MQ Caution 2 / Forrester Capabilities",
      "source_type": "review_platform|analyst_forrester|analyst_gartner|website|field_note",
      "signal_strength": "Strong|Moderate",
      "weakness_summary": "neutral 1-2 sentence description of the competitor weakness",
      "fud_angle": "how a sales rep uses this in a competitive deal — specific and actionable",
      "discovery_question": "question to ask the prospect to surface this pain point naturally",
      "proof_point": "placeholder — [PMM to complete] how your product addresses this weakness",
      "corroborating_sources": ["list of other sources that confirm this weakness"],
      "pmm_confirmed": true or false
    }
  ],
  "competitive_overlaps": [
    {
      "area": "capability or strength area",
      "competitor_claim": "what the competitor claims",
      "your_claim": "what your product claims",
      "recommended_response": "how to handle this overlap in a deal"
    }
  ]
}

Rules:
- Maximum 8 FUD candidates, minimum 3
- Rank by signal strength first, then source corroboration
- Every FUD candidate must have a discovery_question
- proof_point should be left as placeholder text for PMM to complete
- Be specific — generic FUD is useless to a sales rep
- Do not fabricate weaknesses not supported by the data`;

      const userMessage = `Analyze all available intelligence for ${competitor.company_name} ${competitor.product_name} and produce a ranked FUD analysis.

REVIEW DATA:
${reviewSummary || 'No review data available'}

FORRESTER WAVE DATA:
${forresterSummary || 'No Forrester Wave data available'}

GARTNER MQ DATA:
${gartnerSummary || 'No Gartner MQ data available'}

COMPETITOR WEBSITE DATA:
${websiteSummary || 'No website research available'}

FIELD NOTES FROM TEAM:
${fieldNotesSummary}

Produce the FUD analysis JSON now.`;

      const result = await callClaude(systemPrompt, userMessage);

      let analysisData;
      try {
        const raw = result.replace(/```json|```/g, '').trim();
        analysisData = JSON.parse(raw);
      } catch(e) {
        return respond(200, {
          debug_error: "Failed to parse FUD analysis JSON",
          raw_result: result
        });
      }

      // Return to PMM for review before saving
      return respond(200, {
        mode: "analysis_ready_for_review",
        productId,
        competitorId,
        productName: product.product_name,
        competitorName: `${competitor.company_name} ${competitor.product_name}`,
        fudCandidates: analysisData.fud_candidates,
        competitiveOverlaps: analysisData.competitive_overlaps,
        sourcesUsed: {
          reviewSources: reviewData.length,
          forresterReports: forresterData.length,
          gartnerReports: gartnerData.length,
          websiteResearch: websiteData.length,
          fieldNotes: fieldNotes?.length || 0
        },
        existingFUDCount: existingFUD?.length || 0,
        message: `FUD analysis complete for **${competitor.company_name} ${competitor.product_name}**.\n\nFound **${analysisData.fud_candidates?.length || 0} FUD candidates** and **${analysisData.competitive_overlaps?.length || 0} competitive overlaps**.\n\nPlease review the candidates and submit with approve_and_save to write them to the database.`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: approve_and_save
    // PMM has reviewed FUD candidates
    // Archives existing FUD, writes new candidates
    // ─────────────────────────────────────────────
    if (mode === "approve_and_save") {
      const { fudCandidates, competitiveOverlaps } = body;

      // Load existing active FUD candidates for versioning
      const { data: existingFUD } = await supabase
        .from('fud_candidates')
        .select('*')
        .eq('product_id', productId)
        .eq('competitor_id', competitorId)
        .eq('status', 'active');

      // Archive existing FUD candidates
      if (existingFUD && existingFUD.length > 0) {
        for (const fud of existingFUD) {
          // Save to fud_versions
          await supabase.from('fud_versions').insert({
            fud_candidate_id: fud.id,
            version_number: fud.current_version,
            snapshot: JSON.stringify(fud),
            change_reason: changeReason || 'FUD analysis updated',
            changed_by: userId || null,
            changed_at: new Date().toISOString()
          });
        }

        // Mark existing as archived
        await supabase
          .from('fud_candidates')
          .update({ status: 'archived' })
          .eq('product_id', productId)
          .eq('competitor_id', competitorId)
          .eq('status', 'active');
      }

      // Write new FUD candidates
      const newFUDRecords = fudCandidates.map(f => ({
        product_id: productId,
        competitor_id: competitorId,
        source: f.source,
        source_type: f.source_type,
        signal_strength: f.signal_strength,
        weakness_summary: f.weakness_summary,
        fud_angle: f.fud_angle,
        discovery_question: f.discovery_question,
        proof_point: f.proof_point,
        status: 'active',
        current_version: 1,
        created_by: userId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('fud_candidates')
        .insert(newFUDRecords);

      if (insertError) {
        throw new Error(`Failed to save FUD candidates: ${JSON.stringify(insertError)}`);
      }

      // Update competitor profile with latest intelligence
      await supabase
        .from('competitor_profiles')
        .update({
          known_weaknesses: fudCandidates
            .map(f => `${f.source}: ${f.weakness_summary}`)
            .join('\n'),
          updated_at: new Date().toISOString()
        })
        .eq('id', competitorId);

      return respond(200, {
        mode: "fud_saved",
        message: `**FUD analysis saved successfully.**\n\n- ${newFUDRecords.length} FUD candidates written to database\n- ${existingFUD?.length || 0} previous candidates archived\n- Competitor profile updated\n\nReady for battlecard assembly.`,
        savedCount: newFUDRecords.length,
        archivedCount: existingFUD?.length || 0
      });
    }

    // ─────────────────────────────────────────────
    // MODE: get_fud_for_competitor
    // Returns all active FUD candidates for a
    // product/competitor pair
    // ─────────────────────────────────────────────
    if (mode === "get_fud_for_competitor") {
      const { data: fudCandidates, error } = await supabase
        .from('fud_candidates')
        .select('*')
        .eq('product_id', productId)
        .eq('competitor_id', competitorId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw new Error(JSON.stringify(error));

      return respond(200, {
        mode: "fud_results",
        productId,
        competitorId,
        fudCandidates: fudCandidates || [],
        count: fudCandidates?.length || 0
      });
    }

    // ─────────────────────────────────────────────
    // MODE: update_proof_point
    // PMM completes the proof_point placeholder
    // for a specific FUD candidate
    // ─────────────────────────────────────────────
    if (mode === "update_proof_point") {
      const { fudCandidateId, proofPoint } = body;

      // Load current record for versioning
      const { data: current } = await supabase
        .from('fud_candidates')
        .select('*')
        .eq('id', fudCandidateId)
        .single();

      if (!current) return respond(400, { error: "FUD candidate not found" });

      // Archive current version
      await supabase.from('fud_versions').insert({
        fud_candidate_id: fudCandidateId,
        version_number: current.current_version,
        snapshot: JSON.stringify(current),
        change_reason: 'Proof point updated by PMM',
        changed_by: userId || null,
        changed_at: new Date().toISOString()
      });

      // Update with new proof point
      await supabase
        .from('fud_candidates')
        .update({
          proof_point: proofPoint,
          current_version: current.current_version + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', fudCandidateId);

      return respond(200, {
        mode: "proof_point_updated",
        message: "Proof point saved. Previous version archived."
      });
    }

    // ─────────────────────────────────────────────
    // MODE: create_fud_job
    // Creates async job and triggers background function
    // ─────────────────────────────────────────────
    if (mode === "create_fud_job") {
      const job_id = `fud_${competitorId}_${Date.now()}`;

      // Create job row
      const { error: insertError } = await supabase.from('research_results').insert({
        job_id,
        mode: 'fud_analysis',
        competitor: competitorId,
        product_name: productId,
        competitor_id: competitorId,
        status: 'pending'
      });
      if (insertError) throw new Error(`Failed to create FUD job: ${JSON.stringify(insertError)}`);

      // Trigger background function
      await fetch(`${process.env.URL}/.netlify/functions/fud-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id, productId, competitorId })
      });

      return respond(200, {
        job_id,
        status: 'pending',
        message: 'FUD analysis job created. Poll /research-status with job_id to check progress.'
      });
    }

    return respond(400, {
      error: "Invalid mode. Use: create_fud_job, approve_and_save, get_fud_for_competitor, update_proof_point"
    });

  } catch (error) {
    return respond(200, {
      debug_error: error.message,
      debug_stack: error.stack,
      debug_mode: body ? body.mode : "unknown"
    });
  }
};