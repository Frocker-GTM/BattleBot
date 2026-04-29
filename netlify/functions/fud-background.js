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

  const { job_id, productId, competitorId } = body;

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
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data.content[0].text;
  }

  try {

    // Update job status to running
    await supabase
      .from('research_results')
      .update({ status: 'running' })
      .eq('job_id', job_id);

    // Load product profile
    const { data: product, error: productError } = await supabase
      .from('user_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError || !product) throw new Error(`Product not found: ${JSON.stringify(productError)}`);

    // Load competitor profile
    const { data: competitor, error: competitorError } = await supabase
      .from('competitor_profiles')
      .select('*')
      .eq('id', competitorId)
      .single();

    if (competitorError || !competitor) throw new Error(`Competitor not found: ${JSON.stringify(competitorError)}`);

    // Load review research results
    const { data: reviewResults } = await supabase
      .from('research_results')
      .select('*')
      .eq('competitor_id', competitorId)
      .in('mode', ['research_g2', 'research_trustradius', 'research_gartner_peers'])
      .eq('status', 'complete');

    // Load website research
    const { data: websiteResults } = await supabase
      .from('research_results')
      .select('*')
      .eq('competitor_id', competitorId)
      .eq('mode', 'research_website')
      .eq('status', 'complete');

    // Load Forrester extractions
    const { data: forresterResults } = await supabase
      .from('research_results')
      .select('*')
      .eq('competitor_id', competitorId)
      .eq('mode', 'analyst_forrester')
      .eq('status', 'complete');

    // Load Gartner extractions
    const { data: gartnerResults } = await supabase
      .from('research_results')
      .select('*')
      .eq('competitor_id', competitorId)
      .eq('mode', 'analyst_gartner')
      .eq('status', 'complete');

    // Load field notes
    const { data: fieldNotes } = await supabase
      .from('field_notes')
      .select('*')
      .eq('competitor_id', competitorId);

    // Build review summary
    const reviewSummary = (reviewResults || []).map(r => `
SOURCE: ${r.mode.replace('research_', '').toUpperCase()} Reviews
${r.result}
`).join('\n---\n') || 'No review data available';

    // Build website summary
    const websiteSummary = (websiteResults || []).map(r => `
SOURCE: Competitor Website
${r.result}
`).join('\n---\n') || 'No website research available';

    // Build Forrester summary
    const forresterSummary = (forresterResults || []).map(r => {
      try {
        const p = JSON.parse(r.result);
        return `
SOURCE: Forrester Wave (${p.wave_name} ${p.wave_quarter} ${p.wave_year})
Placement: ${p.wave_placement} | Halo: ${p.customer_feedback_halo}
Current Offering: ${p.current_offering_composite} | Strategy: ${p.strategy_composite}
Criteria scoring 1 (below par): ${p.criteria?.filter(c => c.score === 1).map(c => c.name).join(', ') || 'None'}
Capabilities: ${p.capabilities_narrative}
Customer Feedback: ${p.customer_feedback_narrative}
PMM Context — Capabilities: ${p.pmm_context?.capabilities_narrative || 'None'}
PMM Context — Customer Feedback: ${p.pmm_context?.customer_feedback_narrative || 'None'}
Confidence: ${p.pmm_confidence_score}/5`;
      } catch(e) { return r.result; }
    }).join('\n---\n') || 'No Forrester Wave data available';

    // Build Gartner summary
    const gartnerSummary = (gartnerResults || []).map(r => {
      try {
        const p = JSON.parse(r.result);
        return `
SOURCE: Gartner MQ (${p.mq_name} ${p.mq_month} ${p.mq_year})
Quadrant: ${p.mq_quadrant} | Vision: ${p.vision_axis_position} | Execution: ${p.execution_axis_position}
Caution 1 — ${p.caution_1_label}: ${p.caution_1_paragraph}
PMM Context: ${p.pmm_context?.caution_1?.response || 'None'}
Caution 2 — ${p.caution_2_label}: ${p.caution_2_paragraph}
PMM Context: ${p.pmm_context?.caution_2?.response || 'None'}
Caution 3 — ${p.caution_3_label}: ${p.caution_3_paragraph}
PMM Context: ${p.pmm_context?.caution_3?.response || 'None'}
Confidence: ${p.pmm_confidence_score}/5`;
      } catch(e) { return r.result; }
    }).join('\n---\n') || 'No Gartner MQ data available';

    // Build field notes summary
    const fieldNotesSummary = (fieldNotes || []).map(n =>
      `[${n.note_type?.toUpperCase() || 'NOTE'}] ${n.note}${n.deal_context ? ` (Deal: ${n.deal_context})` : ''}`
    ).join('\n') || 'None';

    // Build system prompt
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
Known Weaknesses: ${competitor.known_weaknesses || 'See research data below'}

SOURCE WEIGHTING (apply in this order):
1. Aggregate review data — HIGHEST weight — real users at scale
2. Forrester customer feedback — HIGH weight
3. Gartner MQ Cautions confirmed by PMM — MEDIUM-HIGH weight
4. Forrester criterion scores × confidence — MEDIUM weight
5. Competitor website claims — LOW weight
6. Individual quotes — LOWEST weight

FUD FLAGGING RULES:
- Competitor weakness your product directly addresses = Strong FUD signal
- PMM-confirmed weakness = elevate priority
- Weakness corroborated by multiple sources = elevate priority
- Weakness competitor has addressed = deprioritize
- Commodity capability = not a differentiator
- Competitor strength overlapping yours = competitive overlap, NOT FUD

Return a JSON object:
{
  "fud_candidates": [
    {
      "source": "source name",
      "source_type": "review_platform|analyst_forrester|analyst_gartner|website|field_note",
      "signal_strength": "Strong|Moderate",
      "weakness_summary": "neutral 1-2 sentence description",
      "fud_angle": "specific actionable angle for sales rep",
      "discovery_question": "question to ask prospect to surface this pain",
      "proof_point": "[PMM to complete] how your product addresses this",
      "corroborating_sources": ["other sources confirming this weakness"],
      "pmm_confirmed": true or false
    }
  ],
  "competitive_overlaps": [
    {
      "area": "capability area",
      "competitor_claim": "what competitor claims",
      "your_claim": "what your product claims",
      "recommended_response": "how to handle in a deal"
    }
  ]
}

Rules:
- Maximum 8 FUD candidates, minimum 3
- Rank by signal strength then source corroboration
- Every FUD candidate must have a discovery_question
- proof_point = placeholder for PMM to complete
- Be specific — generic FUD is useless
- Do not fabricate weaknesses not in the data`;

    const userMessage = `Analyze all available intelligence for ${competitor.company_name} ${competitor.product_name} and produce a ranked FUD analysis.

REVIEW DATA:
${reviewSummary}

FORRESTER WAVE DATA:
${forresterSummary}

GARTNER MQ DATA:
${gartnerSummary}

COMPETITOR WEBSITE DATA:
${websiteSummary}

FIELD NOTES:
${fieldNotesSummary}

Produce the FUD analysis JSON now.`;

    const result = await callClaude(systemPrompt, userMessage);

    let analysisData;
    try {
      // Strip markdown code fences and any leading/trailing whitespace
      let raw = result
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      
      // If still failing, try to extract JSON object directly
      if (!raw.startsWith('{')) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) raw = match[0];
      }
      
      analysisData = JSON.parse(raw);
    } catch(e) {
      throw new Error(`Failed to parse Claude response: ${result.substring(0, 200)}`);
    }

    // Save result to research_results
    await supabase
      .from('research_results')
      .update({
        status: 'complete',
        result: JSON.stringify({
          fud_candidates: analysisData.fud_candidates,
          competitive_overlaps: analysisData.competitive_overlaps,
          product_id: productId,
          competitor_id: competitorId,
          sources_used: {
            review_sources: reviewResults?.length || 0,
            forrester_reports: forresterResults?.length || 0,
            gartner_reports: gartnerResults?.length || 0,
            website_research: websiteResults?.length || 0,
            field_notes: fieldNotes?.length || 0
          }
        })
      })
      .eq('job_id', job_id);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    await supabase
      .from('research_results')
      .update({
        status: 'error',
        result: error.message
      })
      .eq('job_id', job_id);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};