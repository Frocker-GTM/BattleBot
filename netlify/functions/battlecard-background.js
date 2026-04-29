const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { job_id, jobType, productId, competitorId } = body;

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

    // Update job to running
    await supabase
      .from('research_results')
      .update({ status: 'running' })
      .eq('job_id', job_id);

    // Load product and competitor profiles
    const { data: product } = await supabase
      .from('user_products')
      .select('*')
      .eq('id', productId)
      .single();

    const { data: competitor } = await supabase
      .from('competitor_profiles')
      .select('*')
      .eq('id', competitorId)
      .single();

    if (!product || !competitor) throw new Error('Product or competitor not found');

    // Load all research results for this competitor
    const { data: allResearch } = await supabase
      .from('research_results')
      .select('*')
      .eq('competitor_id', competitorId)
      .eq('status', 'complete');

    // Load FUD candidates
    const { data: fudCandidates } = await supabase
      .from('fud_candidates')
      .select('*')
      .eq('product_id', productId)
      .eq('competitor_id', competitorId)
      .eq('status', 'active');

    // Organize research by type
    const reviewData = allResearch?.filter(r =>
      ['research_g2', 'research_trustradius', 'research_gartner_peers'].includes(r.mode)
    ) || [];

    const gartnerData = allResearch?.filter(r => r.mode === 'analyst_gartner') || [];
    const forresterData = allResearch?.filter(r => r.mode === 'analyst_forrester') || [];
    const websiteData = allResearch?.filter(r => r.mode === 'research_website') || [];

    // Build intelligence summary for Claude
    const reviewSummary = reviewData.map(r => `${r.mode.toUpperCase()}: ${r.result}`).join('\n\n---\n\n');

    const gartnerSummary = gartnerData.map(r => {
      try {
        const p = JSON.parse(r.result);
        return `GARTNER MQ (${p.mq_name} ${p.mq_year}):
Quadrant: ${p.mq_quadrant} | Vision: ${p.vision_axis_position} | Execution: ${p.execution_axis_position}
Strengths: ${[p.strength_1_label, p.strength_2_label, p.strength_3_label].filter(Boolean).join(' | ')}
Cautions: ${[p.caution_1_label, p.caution_2_label, p.caution_3_label].filter(Boolean).join(' | ')}
Caution detail: ${p.caution_1_paragraph} ${p.caution_2_paragraph} ${p.caution_3_paragraph}
PMM context on cautions: ${JSON.stringify(p.pmm_context)}`;
      } catch(e) { return r.result; }
    }).join('\n\n');

    const forresterSummary = forresterData.map(r => {
      try {
        const p = JSON.parse(r.result);
        return `FORRESTER WAVE (${p.wave_name} ${p.wave_year}):
Placement: ${p.wave_placement} | Halo: ${p.customer_feedback_halo}
Current Offering: ${p.current_offering_composite} | Strategy: ${p.strategy_composite}
Below par criteria: ${p.criteria?.filter(c => c.score === 1).map(c => c.name).join(', ') || 'None'}
Capabilities: ${p.capabilities_narrative}
Customer Feedback: ${p.customer_feedback_narrative}`;
      } catch(e) { return r.result; }
    }).join('\n\n');

    const websiteSummary = websiteData.map(r => `COMPETITOR WEBSITE: ${r.result}`).join('\n\n');

    const fudSummary = fudCandidates?.map(f =>
      `FUD: ${f.weakness_summary} (${f.signal_strength})`
    ).join('\n') || 'None';

    const intelligenceSummary = [
      reviewSummary && `=== REVIEW DATA ===\n${reviewSummary}`,
      gartnerSummary && `=== GARTNER MQ ===\n${gartnerSummary}`,
      forresterSummary && `=== FORRESTER WAVE ===\n${forresterSummary}`,
      websiteSummary && `=== COMPETITOR WEBSITE ===\n${websiteSummary}`,
      fudSummary && `=== FUD CANDIDATES ===\n${fudSummary}`,
    ].filter(Boolean).join('\n\n');

    // ─────────────────────────────────────────────
    // JOB TYPE: scoring
    // Score each use case component 0-4
    // ─────────────────────────────────────────────
    if (jobType === 'scoring') {

      const useCases = typeof product.use_cases === 'string'
        ? JSON.parse(product.use_cases)
        : product.use_cases;

      const systemPrompt = `You are a competitive intelligence analyst scoring use case capabilities for a battlecard.

Score both YOUR PRODUCT and the COMPETITOR on each use case and subcomponent using this scale:
4 = Clear leader — multiple sources confirm superiority
3 = Strong — generally positive signals
2 = Adequate — meets basic requirements  
1 = Weak — documented gaps
0 = Not present or not applicable

YOUR PRODUCT:
Name: ${product.product_name}
Strengths: ${product.strengths}
Key Differentiators: ${product.key_differentiators}
Positioning: ${product.positioning}

COMPETITOR:
Company: ${competitor.company_name}
Product: ${competitor.product_name}
Known Weaknesses: ${competitor.known_weaknesses}

Use the intelligence data provided to justify every score.
For each use case, also provide 2-3 subcomponents that break down the capability.

Return ONLY valid JSON:
{
  "scored_use_cases": [
    {
      "uc_name": "use case name",
      "uc_persona": "target persona for this use case",
      "uc_our_score": 0-4,
      "uc_their_score": 0-4,
      "uc_rationale": "brief explanation of scores",
      "subcomponents": [
        {
          "sub_name": "subcomponent name",
          "sub_evidence_label": "source name",
          "sub_evidence_href": "#",
          "our_score": 0-4,
          "their_score": 0-4,
          "rationale": "brief explanation"
        }
      ]
    }
  ]
}`;

      const userMessage = `Score these use cases for ${product.product_name} vs ${competitor.company_name} ${competitor.product_name}:

USE CASES TO SCORE:
${JSON.stringify(useCases, null, 2)}

INTELLIGENCE DATA:
${intelligenceSummary}

Return scored use cases JSON.`;

      const result = await callClaude(systemPrompt, userMessage);

      let scoringData;
      try {
        const raw = result.replace(/```json|```/g, '').trim();
        scoringData = JSON.parse(raw);
      } catch(e) {
        throw new Error(`Failed to parse scoring response: ${result.substring(0, 300)}`);
      }

      await supabase
        .from('research_results')
        .update({
          status: 'complete',
          competitor_id: competitorId,
          result: JSON.stringify({
            jobType: 'scoring',
            scored_use_cases: scoringData.scored_use_cases,
            product_id: productId,
            competitor_id: competitorId
          })
        })
        .eq('job_id', job_id);

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // ─────────────────────────────────────────────
    // JOB TYPE: swot
    // Generate SWOT for the competitor
    // ─────────────────────────────────────────────
    if (jobType === 'swot') {

      const systemPrompt = `You are a competitive intelligence analyst generating a SWOT analysis for a competitor.

This SWOT is from YOUR PRODUCT's perspective — assessing the competitor.

YOUR PRODUCT:
Name: ${product.product_name}
Strengths: ${product.strengths}
Key Differentiators: ${product.key_differentiators}

COMPETITOR:
Company: ${competitor.company_name}
Product: ${competitor.product_name}

Guidelines:
- Strengths: What the competitor genuinely does well — be honest, not dismissive
- Weaknesses: Documented gaps confirmed by research and/or PMM context
- Opportunities: Where your product can exploit competitor weaknesses in deals
- Threats: Where the competitor could hurt your win rate if left unaddressed

Each bullet should be specific and actionable — not generic.
Maximum 4 bullets per quadrant, minimum 2.

Return ONLY valid JSON:
{
  "swot": {
    "strengths": ["bullet", "bullet", "bullet"],
    "weaknesses": ["bullet", "bullet", "bullet"],
    "opportunities": ["bullet", "bullet", "bullet"],
    "threats": ["bullet", "bullet", "bullet"]
  }
}`;

      const userMessage = `Generate a SWOT analysis for ${competitor.company_name} ${competitor.product_name} based on this intelligence:

${intelligenceSummary}

Return the SWOT JSON.`;

      const result = await callClaude(systemPrompt, userMessage);

      let swotData;
      try {
        const raw = result.replace(/```json|```/g, '').trim();
        swotData = JSON.parse(raw);
      } catch(e) {
        throw new Error(`Failed to parse SWOT response: ${result.substring(0, 300)}`);
      }

      await supabase
        .from('research_results')
        .update({
          status: 'complete',
          competitor_id: competitorId,
          result: JSON.stringify({
            jobType: 'swot',
            swot: swotData.swot,
            product_id: productId,
            competitor_id: competitorId
          })
        })
        .eq('job_id', job_id);

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    throw new Error(`Unknown jobType: ${jobType}`);

  } catch (error) {
    await supabase
      .from('research_results')
      .update({ status: 'error', result: error.message })
      .eq('job_id', job_id);

    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};