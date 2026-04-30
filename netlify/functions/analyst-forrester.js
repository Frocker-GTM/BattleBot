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

  const { mode, sessionId, pmmResponse } = body;

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
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    return data.content[0].text;
  }

  async function saveSession(sessionId, state) {
    const { error } = await supabase
      .from('analyst_sessions')
      .upsert({
        session_id: sessionId,
        report_type: 'forrester_wave',
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
    // MODE: start_extraction
    // ─────────────────────────────────────────────
    if (mode === "start_extraction") {
      const { waveName, waveQuarter, waveYear, analystName, vendorName, productName, competitorId: bodyCompetitorId } = body;

      const sessionState = {
        step: "awaiting_score_table",
        waveName, waveQuarter, waveYear, analystName,
        vendorName, productName,
        competitorId: bodyCompetitorId || null,
        extractedData: {
          report_type: "Forrester Wave",
          wave_name: waveName,
          wave_quarter: waveQuarter,
          wave_year: waveYear,
          analyst_name: analystName || null,
          vendor_name: vendorName,
          product_name: productName,
          extraction_date: new Date().toISOString().split('T')[0],
          current_offering_composite: null,
          strategy_composite: null,
          criteria: [],
          wave_placement: null,
          customer_feedback_halo: null,
          placement_boundary_note: null,
          strategy_narrative: null,
          capabilities_narrative: null,
          customer_feedback_narrative: null,
          forresters_take: null,
          pmm_context: {},
          fud_candidates: [],
          pmm_confidence_score: null
        }
      };

      await saveSession(sessionId, sessionState);

      return respond(200, {
        sessionId,
        step: "awaiting_score_table",
        message: `Got it — starting Forrester Wave extraction for **${vendorName}** from the **${waveName} ${waveQuarter} ${waveYear}** Wave.\n\n**Step 1 of 5 — Score Table**\n\nPlease upload a screenshot of the score table showing ${vendorName}'s column. If the table spans multiple pages, upload all pages.\n\nI'm looking for the criterion names, Forrester weightings, and ${vendorName}'s scores (1, 3, or 5 only).`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: process_score_table
    // ─────────────────────────────────────────────
    if (mode === "process_score_table") {
      const { imageBase64 } = body;
      const session = await loadSession(sessionId);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: imageBase64 }
              },
              {
                type: "text",
                text: `Extract Forrester Wave scores for ${session.vendorName} from this score table.

Rules:
- Forrester ONLY uses scores of 1, 3, or 5. Never 2 or 4.
- Extract ONLY ${session.vendorName}'s column — ignore all other vendors
- Record composite scores from the header row exactly as shown
- Separate criteria into Current Offering and Strategy sections

Return ONLY valid JSON:
{
  "current_offering_composite": 0.0,
  "strategy_composite": 0.0,
  "current_offering_criteria": [
    { "name": "criterion name", "weight": "5%", "score": 3 }
  ],
  "strategy_criteria": [
    { "name": "criterion name", "weight": "25%", "score": 3 }
  ],
  "extraction_notes": "any issues or null"
}`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));

      let scoreData;
      try {
        const raw = data.content[0].text.replace(/```json|```/g, '').trim();
        scoreData = JSON.parse(raw);
      } catch(e) {
        return respond(200, {
          sessionId, step: "score_table_parse_error",
          message: "I had trouble parsing the score table. Could you re-upload the image? Make sure the table is clearly visible and not cut off."
        });
      }

      session.extractedData.current_offering_composite = scoreData.current_offering_composite;
      session.extractedData.strategy_composite = scoreData.strategy_composite;
      session.extractedData.criteria = [
        ...scoreData.current_offering_criteria.map(c => ({ ...c, section: "Current Offering" })),
        ...scoreData.strategy_criteria.map(c => ({ ...c, section: "Strategy" }))
      ];
      session.step = "awaiting_wave_graphic";
      await saveSession(sessionId, session);

      return respond(200, {
        sessionId,
        step: "awaiting_wave_graphic",
        message: `Score table extracted for **${session.vendorName}**:\n- Current Offering composite: ${scoreData.current_offering_composite}\n- Strategy composite: ${scoreData.strategy_composite}\n- Total criteria captured: ${session.extractedData.criteria.length}\n${scoreData.extraction_notes ? `\nNote: ${scoreData.extraction_notes}\n` : ""}\n**Step 2 of 5 — Wave Graphic**\n\nNow please upload a screenshot of the Wave graphic (the quadrant chart). I need to capture ${session.vendorName}'s placement and customer feedback halo status.`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: process_wave_graphic
    // ─────────────────────────────────────────────
    if (mode === "process_wave_graphic") {
      const { imageBase64 } = body;
      const session = await loadSession(sessionId);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: imageBase64 }
              },
              {
                type: "text",
                text: `Analyze this Forrester Wave graphic for vendor: ${session.vendorName}

Placements: Leaders (top right), Strong Performers (middle), Contenders (left), Challengers (bottom)
Customer feedback halo: No ring = below average, Single ring = above average, Double ring = Customer Favorite

Return ONLY valid JSON:
{
  "wave_placement": "Leader|Strong Performer|Contender|Challenger",
  "customer_feedback_halo": "None|Single|Double",
  "placement_boundary_note": "note if on boundary or null",
  "placement_confidence": "High|Medium|Low",
  "notes": "any observations or null"
}`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));

      let placementData;
      try {
        const raw = data.content[0].text.replace(/```json|```/g, '').trim();
        placementData = JSON.parse(raw);
      } catch(e) {
        return respond(200, {
          sessionId, step: "wave_graphic_parse_error",
          message: "I had trouble reading the Wave graphic. Could you re-upload it? Make sure the vendor name labels are visible."
        });
      }

      session.extractedData.wave_placement = placementData.wave_placement;
      session.extractedData.customer_feedback_halo = placementData.customer_feedback_halo;
      session.extractedData.placement_boundary_note = placementData.placement_boundary_note;
      session.step = "awaiting_vendor_profile";
      await saveSession(sessionId, session);

      const haloDesc = {
        "None": "no customer feedback halo (below average)",
        "Single": "a single halo (above average customer feedback)",
        "Double": "a double halo — Customer Favorite ⭐"
      };

      return respond(200, {
        sessionId,
        step: "awaiting_vendor_profile",
        message: `Wave placement captured for **${session.vendorName}**:\n- Placement: **${placementData.wave_placement}**\n- Customer feedback: ${haloDesc[placementData.customer_feedback_halo] || placementData.customer_feedback_halo}\n${placementData.placement_boundary_note ? `- Note: ${placementData.placement_boundary_note}\n` : ""}\n**Step 3 of 5 — Vendor Profile**\n\nNow please copy and paste the full ${session.vendorName} vendor profile section from the Wave report. This should include the Strategy paragraph, Capabilities paragraph, Customer feedback paragraph, and Forrester's Take sentence.`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: process_vendor_profile
    // ─────────────────────────────────────────────
    if (mode === "process_vendor_profile") {
      const { profileText } = body;
      const session = await loadSession(sessionId);

      const systemPrompt = `You are a Forrester Wave data extraction specialist.
Parse the following vendor profile text and extract the four sections verbatim.

Return ONLY valid JSON:
{
  "strategy_narrative": "full strategy paragraph verbatim",
  "capabilities_narrative": "full capabilities paragraph verbatim",
  "customer_feedback_narrative": "full customer feedback paragraph verbatim",
  "forresters_take": "the single Forrester's Take sentence verbatim",
  "parse_notes": "any issues finding the sections or null"
}

Important: Extract verbatim. Do not summarize or paraphrase.`;

      const result = await callClaude(systemPrompt, profileText);

      let profileData;
      try {
        const raw = result.replace(/```json|```/g, '').trim();
        profileData = JSON.parse(raw);
      } catch(e) {
        return respond(200, {
          sessionId, step: "profile_parse_error",
          message: "I had trouble parsing the vendor profile. Please make sure you've copied the full section including Strategy, Capabilities, Customer feedback, and Forrester's Take paragraphs."
        });
      }

      session.extractedData.strategy_narrative = profileData.strategy_narrative;
      session.extractedData.capabilities_narrative = profileData.capabilities_narrative;
      session.extractedData.customer_feedback_narrative = profileData.customer_feedback_narrative;
      session.extractedData.forresters_take = profileData.forresters_take;

      session.reviewQueue = [
        {
          field: "strategy_narrative",
          label: "Strategy",
          stepNum: "3a",
          text: profileData.strategy_narrative,
          prompt: `Here is Forrester's **Strategy** assessment for ${session.vendorName}:\n\n---\n${profileData.strategy_narrative}\n---\n\nDoes this accurately reflect the current state of ${session.vendorName}'s strategy? Please add any context from the field that would affect how we use this in a battlecard.`
        },
        {
          field: "capabilities_narrative",
          label: "Capabilities",
          stepNum: "3b",
          text: profileData.capabilities_narrative,
          prompt: `Here is Forrester's **Capabilities** assessment for ${session.vendorName}:\n\n---\n${profileData.capabilities_narrative}\n---\n\nDoes this accurately reflect their current product? Please add any context around gaps or strengths that affect battlecard positioning.`
        },
        {
          field: "customer_feedback_narrative",
          label: "Customer Feedback",
          stepNum: "3c",
          text: profileData.customer_feedback_narrative,
          highWeight: true,
          prompt: `Here is Forrester's **Customer Feedback** summary for ${session.vendorName}:\n\n⭐ This carries the **highest weight** in our analysis.\n\n---\n${profileData.customer_feedback_narrative}\n---\n\nDoes this match what you hear in the field? Please add any context from your own customer conversations.`
        },
        {
          field: "forresters_take",
          label: "Forrester's Take",
          stepNum: "3d",
          text: profileData.forresters_take,
          prompt: `Here is Forrester's **ICP recommendation** for ${session.vendorName}:\n\n---\n${profileData.forresters_take}\n---\n\nDoes their target buyer overlap with yours? This helps us understand where you are most likely to compete head-to-head.`
        }
      ];

      session.currentReviewIndex = 0;
      session.step = "pmm_review";
      await saveSession(sessionId, session);

      const first = session.reviewQueue[0];

      return respond(200, {
        sessionId,
        step: "pmm_review",
        reviewField: first.field,
        message: `Profile parsed successfully.\n\nFound:\n- Strategy ✓\n- Capabilities ✓\n- Customer Feedback ✓\n- Forrester's Take ✓\n${profileData.parse_notes ? `\nNote: ${profileData.parse_notes}\n` : ""}\nBeginning PMM review — no scoring or FUD decisions until all sections reviewed.\n\n**Step ${first.stepNum} of 5 — ${first.label}**\n\n${first.prompt}`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: submit_pmm_review
    // ─────────────────────────────────────────────
    if (mode === "submit_pmm_review") {
      const session = await loadSession(sessionId);
      const current = session.reviewQueue[session.currentReviewIndex];

      session.extractedData.pmm_context[current.field] = pmmResponse;
      session.currentReviewIndex += 1;

      if (session.currentReviewIndex < session.reviewQueue.length) {
        const next = session.reviewQueue[session.currentReviewIndex];
        await saveSession(sessionId, session);

        const highWeightNote = next.highWeight
          ? "\n⭐ **Note: Customer Feedback carries the highest weight in our analysis.**\n"
          : "";

        return respond(200, {
          sessionId,
          step: "pmm_review",
          reviewField: next.field,
          message: `Context noted for ${current.label}. Moving on.\n\n**Step ${next.stepNum} of 5 — ${next.label}**\n${highWeightNote}\n${next.prompt}`
        });
      }

      session.step = "awaiting_confidence_score";
      await saveSession(sessionId, session);

      return respond(200, {
        sessionId,
        step: "awaiting_confidence_score",
        message: `Context noted for ${current.label}. All sections reviewed.\n\n**Step 4 of 5 — Confidence Score**\n\nOn a scale of 1-5, how would you rate the credibility and relevance of this Wave report for this analysis?\n\n- **5** — Highly current and directly relevant (published within 12 months, exact category match)\n- **4** — Good report with minor timing or category gaps\n- **3** — Moderate — 1-2 years old or adjacent category\n- **2** — Low credibility — significantly dated or tangential\n- **1** — Reference only — do not use for scoring\n\nPlease enter a score 1-5 and click Submit.`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: submit_confidence_score
    // ─────────────────────────────────────────────
    if (mode === "submit_confidence_score") {
      const { confidenceScore } = body;
      const session = await loadSession(sessionId);

      session.extractedData.pmm_confidence_score = parseInt(confidenceScore);

      const score1Criteria = session.extractedData.criteria.filter(c => c.score === 1);

      const fudSystemPrompt = `You are a competitive intelligence analyst reviewing a completed Forrester Wave extraction.

Vendor: ${session.extractedData.vendor_name}
Wave: ${session.extractedData.wave_name} ${session.extractedData.wave_quarter} ${session.extractedData.wave_year}
Placement: ${session.extractedData.wave_placement}
Customer Feedback Halo: ${session.extractedData.customer_feedback_halo}
Current Offering Composite: ${session.extractedData.current_offering_composite}
Strategy Composite: ${session.extractedData.strategy_composite}

Capabilities Narrative: ${session.extractedData.capabilities_narrative}
Customer Feedback Narrative: ${session.extractedData.customer_feedback_narrative}

PMM Context on Capabilities: ${session.extractedData.pmm_context.capabilities_narrative || "None provided"}
PMM Context on Customer Feedback: ${session.extractedData.pmm_context.customer_feedback_narrative || "None provided"}

Criteria scoring 1 (below par):
${score1Criteria.map(c => `- ${c.section}: ${c.name} (${c.weight})`).join('\n') || "None"}

Identify FUD candidates — areas where this vendor has documented weaknesses a competitor could exploit.
Return JSON array, max 5 items, strongest signals first:
[{
  "source": "criterion name or narrative section",
  "signal_strength": "Strong|Moderate",
  "weakness_summary": "brief neutral description",
  "fud_angle": "how a competitor could use this in a deal"
}]`;

      const fudResult = await callClaude(fudSystemPrompt, "Identify FUD candidates.");

      let fudCandidates = [];
      try {
        const raw = fudResult.replace(/```json|```/g, '').trim();
        fudCandidates = JSON.parse(raw);
      } catch(e) { fudCandidates = []; }

      session.extractedData.fud_candidates = fudCandidates;
      session.step = "complete";
      await saveSession(sessionId, session);

      await supabase.from('research_results').insert({
        job_id: `forrester_${session.extractedData.vendor_name}_${Date.now()}`.replace(/\s+/g, '_').toLowerCase(),
        mode: 'analyst_forrester',
        competitor: session.extractedData.vendor_name,
        product_name: session.extractedData.product_name,
        competitor_id: session.competitorId || null,
        result: JSON.stringify(session.extractedData),
        status: 'complete'
      });

      const fudSummary = fudCandidates
        .map((f, i) => `${i + 1}. **${f.source}** (${f.signal_strength})\n   ${f.weakness_summary}`)
        .join('\n');

      return respond(200, {
        sessionId,
        step: "complete",
        message: `**Step 5 of 5 — Complete**\n\nForrester Wave extraction for **${session.extractedData.vendor_name}** is complete.\n\n**Summary:**\n- Wave placement: ${session.extractedData.wave_placement}\n- Customer feedback: ${session.extractedData.customer_feedback_halo}\n- Current Offering: ${session.extractedData.current_offering_composite}\n- Strategy: ${session.extractedData.strategy_composite}\n- Criteria captured: ${session.extractedData.criteria.length}\n- Criteria scoring 1 (below par): ${score1Criteria.length}\n- Confidence score: ${session.extractedData.pmm_confidence_score}/5\n\n**FUD Candidates Identified (${fudCandidates.length}):**\n${fudSummary || "None identified"}\n\nAll data saved. Ready for the next vendor or competitor research.`,
        extractedData: session.extractedData,
        fudCandidates
      });
    }

    return respond(400, {
      error: "Invalid mode. Use: start_extraction, process_score_table, process_wave_graphic, process_vendor_profile, submit_pmm_review, submit_confidence_score"
    });

  } catch (error) {
    return respond(200, {
      debug_error: error.message,
      debug_stack: error.stack,
      debug_mode: body ? body.mode : "unknown"
    });
  }
};