const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const body = JSON.parse(event.body);
    const { mode, vendor, sessionId, pmmResponse, extractedData } = body;

    // Helper: call Claude without web search
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

    // Helper: save session state to Supabase
    async function saveSession(sessionId, state) {
      await supabase
        .from('analyst_sessions')
        .upsert({
          session_id: sessionId,
          report_type: 'forrester_wave',
          state: JSON.stringify(state),
          updated_at: new Date().toISOString()
        }, { onConflict: 'session_id' });
    }

    // Helper: load session state from Supabase
    async function loadSession(sessionId) {
      const { data, error } = await supabase
        .from('analyst_sessions')
        .select('state')
        .eq('session_id', sessionId)
        .single();
      if (error || !data) return null;
      return JSON.parse(data.state);
    }

    // ─────────────────────────────────────────────
    // MODE: start_extraction
    // PMM provides: wave metadata + vendor name
    // Agent confirms receipt and asks for score table image
    // ─────────────────────────────────────────────
    if (mode === "start_extraction") {
      const { waveName, waveQuarter, waveYear, analystName, vendorName, productName } = body;

      const sessionState = {
        step: "awaiting_score_table",
        waveName, waveQuarter, waveYear, analystName,
        vendorName, productName,
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

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "awaiting_score_table",
          message: `Got it — starting Forrester Wave extraction for **${vendorName}** from the **${waveName} ${waveQuarter} ${waveYear}** Wave.\n\n**Step 1 of 5 — Score Table**\n\nPlease upload a screenshot of the score table showing ${vendorName}'s column. If the table spans multiple pages, upload all pages.\n\nI'm looking for the criterion names, Forrester weightings, and ${vendorName}'s scores (1, 3, or 5 only).`
        })
      };
    }

    // ─────────────────────────────────────────────
    // MODE: process_score_table
    // PMM provides: score table image (as base64) + session
    // Agent extracts composite scores and all criteria
    // ─────────────────────────────────────────────
    if (mode === "process_score_table") {
      const { imageBase64 } = body;
      const session = await loadSession(sessionId);
      if (!session) return { statusCode: 400, body: JSON.stringify({ error: "Session not found" }) };

      const systemPrompt = `You are a Forrester Wave data extraction specialist.
You will receive an image of a Forrester Wave score table.
Extract data ONLY for the vendor: ${session.vendorName}

Rules:
- Forrester ONLY uses scores of 1, 3, or 5. Never 2 or 4. If you see another number, re-check.
- Record the composite Current Offering and Strategy scores from the header row exactly as shown
- Record every criterion name, Forrester weighting percentage, and the vendor's score
- Separate criteria into Current Offering and Strategy sections
- Do not extract any other vendor's data
- If the vendor column is not visible, say so clearly

Return ONLY valid JSON in this exact format:
{
  "current_offering_composite": 0.0,
  "strategy_composite": 0.0,
  "current_offering_criteria": [
    { "name": "criterion name", "weight": "5%", "score": 3 }
  ],
  "strategy_criteria": [
    { "name": "criterion name", "weight": "25%", "score": 3 }
  ],
  "extraction_notes": "any issues or observations"
}`;

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
                text: `Extract Forrester Wave scores for ${session.vendorName} from this score table. Return only JSON.`
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
        return {
          statusCode: 200,
          body: JSON.stringify({
            sessionId, step: "score_table_parse_error",
            message: "I had trouble parsing the score table. Could you re-upload the image? Make sure the table is clearly visible and not cut off.",
            rawResponse: data.content[0].text
          })
        };
      }

      // Update session with extracted scores
      session.extractedData.current_offering_composite = scoreData.current_offering_composite;
      session.extractedData.strategy_composite = scoreData.strategy_composite;
      session.extractedData.criteria = [
        ...scoreData.current_offering_criteria.map(c => ({ ...c, section: "Current Offering" })),
        ...scoreData.strategy_criteria.map(c => ({ ...c, section: "Strategy" }))
      ];
      session.step = "awaiting_wave_graphic";
      await saveSession(sessionId, session);

      const criteriaCount = session.extractedData.criteria.length;
      const coScore = scoreData.current_offering_composite;
      const stScore = scoreData.strategy_composite;

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "awaiting_wave_graphic",
          message: `Score table extracted successfully.\n\n**${session.vendorName} scores:**\n- Current Offering composite: ${coScore}\n- Strategy composite: ${stScore}\n- Total criteria captured: ${criteriaCount}\n\n${scoreData.extraction_notes ? `Note: ${scoreData.extraction_notes}\n\n` : ""}**Step 2 of 5 — Wave Graphic**\n\nNow please upload a screenshot of the Wave graphic (the quadrant chart). I need to capture ${session.vendorName}'s placement and customer feedback halo status.`,
          extractedScores: scoreData
        })
      };
    }

    // ─────────────────────────────────────────────
    // MODE: process_wave_graphic
    // PMM provides: wave graphic image (as base64)
    // Agent extracts placement and halo
    // ─────────────────────────────────────────────
    if (mode === "process_wave_graphic") {
      const { imageBase64 } = body;
      const session = await loadSession(sessionId);
      if (!session) return { statusCode: 400, body: JSON.stringify({ error: "Session not found" }) };

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

Return ONLY valid JSON:
{
  "wave_placement": "Leader|Strong Performer|Contender|Challenger",
  "customer_feedback_halo": "None|Single|Double",
  "placement_boundary_note": "note if on boundary or null",
  "placement_confidence": "High|Medium|Low",
  "notes": "any observations"
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
        return {
          statusCode: 200,
          body: JSON.stringify({
            sessionId, step: "wave_graphic_parse_error",
            message: "I had trouble reading the Wave graphic. Could you re-upload it? Make sure the vendor name labels are visible."
          })
        };
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

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "awaiting_vendor_profile",
          message: `Wave placement captured.\n\n**${session.vendorName}:**\n- Placement: **${placementData.wave_placement}**\n- Customer feedback: ${haloDesc[placementData.customer_feedback_halo] || placementData.customer_feedback_halo}\n${placementData.placement_boundary_note ? `- Note: ${placementData.placement_boundary_note}\n` : ""}\n**Step 3 of 5 — Vendor Profile**\n\nNow please copy and paste the full ${session.vendorName} vendor profile section from the Wave report. This should include the Strategy paragraph, Capabilities paragraph, Customer feedback paragraph, and Forrester's Take sentence.`
        })
      };
    }

    // ─────────────────────────────────────────────
    // MODE: process_vendor_profile
    // PMM provides: copy/pasted vendor profile text
    // Agent parses into 4 sections, begins PMM review
    // ─────────────────────────────────────────────
    if (mode === "process_vendor_profile") {
      const { profileText } = body;
      const session = await loadSession(sessionId);
      if (!session) return { statusCode: 400, body: JSON.stringify({ error: "Session not found" }) };

      const systemPrompt = `You are a Forrester Wave data extraction specialist.
Parse the following vendor profile text and extract the four sections.

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
        return {
          statusCode: 200,
          body: JSON.stringify({
            sessionId, step: "profile_parse_error",
            message: "I had trouble parsing the vendor profile. Please make sure you've copied the full section including Strategy, Capabilities, Customer feedback, and Forrester's Take paragraphs."
          })
        };
      }

      session.extractedData.strategy_narrative = profileData.strategy_narrative;
      session.extractedData.capabilities_narrative = profileData.capabilities_narrative;
      session.extractedData.customer_feedback_narrative = profileData.customer_feedback_narrative;
      session.extractedData.forresters_take = profileData.forresters_take;
      session.step = "review_strategy";
      session.reviewQueue = [
        { field: "strategy_narrative", label: "Strategy", text: profileData.strategy_narrative, stepNum: "3a" },
        { field: "capabilities_narrative", label: "Capabilities", stepNum: "3b", text: profileData.capabilities_narrative },
        { field: "customer_feedback_narrative", label: "Customer Feedback", stepNum: "3c", text: profileData.customer_feedback_narrative, highWeight: true },
        { field: "forresters_take", label: "Forrester's Take", stepNum: "3d", text: profileData.forresters_take }
      ];
      session.currentReviewIndex = 0;
      await saveSession(sessionId, session);

      const current = session.reviewQueue[0];

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "pmm_review",
          reviewField: current.field,
          message: `Profile parsed successfully. Now beginning PMM review — I'll present each section verbatim for your input before making any scoring or FUD decisions.\n\n**Step ${current.stepNum} of 5 — ${current.label} Review**\n\nHere is Forrester's ${current.label} assessment for ${session.vendorName}:\n\n---\n${current.text}\n---\n\nDoes this accurately reflect the current state of ${session.vendorName}'s ${current.label.toLowerCase()}? Please add any context from the field that would affect how we use this in a battlecard.`
        })
      };
    }

    // ─────────────────────────────────────────────
    // MODE: submit_pmm_review
    // PMM provides: their response to the current review step
    // Agent stores context, advances to next step or completes
    // ─────────────────────────────────────────────
    if (mode === "submit_pmm_review") {
      const session = await loadSession(sessionId);
      if (!session) return { statusCode: 400, body: JSON.stringify({ error: "Session not found" }) };

      const current = session.reviewQueue[session.currentReviewIndex];

      // Store PMM context
      session.extractedData.pmm_context[current.field] = pmmResponse;
      session.currentReviewIndex += 1;

      // Check if more reviews remain
      if (session.currentReviewIndex < session.reviewQueue.length) {
        const next = session.reviewQueue[session.currentReviewIndex];
        await saveSession(sessionId, session);

        const highWeightNote = next.highWeight
          ? "\n⭐ **Note: Customer Feedback carries the highest weight in our analysis.**\n"
          : "";

        return {
          statusCode: 200,
          body: JSON.stringify({
            sessionId,
            step: "pmm_review",
            reviewField: next.field,
            message: `Context noted for ${current.label}. Moving on.\n\n**Step ${next.stepNum} of 5 — ${next.label} Review**\n${highWeightNote}\nHere is Forrester's ${next.label} assessment for ${session.vendorName}:\n\n---\n${next.text}\n---\n\nDoes this accurately reflect the current state? Please add any context that would affect how we use this in a battlecard.`
          })
        };
      }

      // All reviews complete — ask for confidence score
      session.step = "awaiting_confidence_score";
      await saveSession(sessionId, session);

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "awaiting_confidence_score",
          message: `Context noted for ${current.label}. All sections reviewed.\n\n**Step 4 of 5 — Confidence Score**\n\nOn a scale of 1-5, how would you rate the credibility and relevance of this Wave report for this analysis?\n\n- **5** — Highly current and directly relevant (published within 12 months, exact category match)\n- **4** — Good report with minor timing or category gaps\n- **3** — Moderate — 1-2 years old or adjacent category\n- **2** — Low credibility — significantly dated or tangential\n- **1** — Reference only — do not use for scoring\n\nPlease reply with a number 1-5.`
        })
      };
    }

    // ─────────────────────────────────────────────
    // MODE: submit_confidence_score
    // PMM provides: confidence score 1-5
    // Agent runs FUD analysis and completes extraction
    // ─────────────────────────────────────────────
    if (mode === "submit_confidence_score") {
      const { confidenceScore } = body;
      const session = await loadSession(sessionId);
      if (!session) return { statusCode: 400, body: JSON.stringify({ error: "Session not found" }) };

      session.extractedData.pmm_confidence_score = parseInt(confidenceScore);

      // Run FUD analysis
      const systemPrompt = `You are a competitive intelligence analyst reviewing a completed Forrester Wave extraction.
      
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

Criteria with score of 1 (below par):
${session.extractedData.criteria.filter(c => c.score === 1).map(c => `- ${c.section}: ${c.name} (${c.weight})`).join('\n') || "None"}

Based on the above, identify FUD candidates — areas where this vendor has documented weaknesses that a competitor could exploit.
For each FUD candidate return:
{
  "source": "criterion name or narrative section",
  "signal_strength": "Strong|Moderate",
  "weakness_summary": "brief neutral description of the weakness",
  "fud_angle": "how a competitor could use this in a deal"
}

Return as JSON array. Maximum 5 candidates. Focus on the strongest signals first.`;

      const fudResult = await callClaude(systemPrompt, "Identify FUD candidates from this Forrester Wave extraction.");

      let fudCandidates = [];
      try {
        const raw = fudResult.replace(/```json|```/g, '').trim();
        fudCandidates = JSON.parse(raw);
      } catch(e) {
        fudCandidates = [];
      }

      session.extractedData.fud_candidates = fudCandidates;
      session.step = "complete";
      await saveSession(sessionId, session);

      // Save final result to research_results
      await supabase
        .from('research_results')
        .insert({
          job_id: `forrester_${session.extractedData.vendor_name}_${Date.now()}`.replace(/\s+/g, '_').toLowerCase(),
          mode: 'analyst_forrester',
          competitor: session.extractedData.vendor_name,
          product_name: session.extractedData.product_name,
          result: JSON.stringify(session.extractedData),
          status: 'complete'
        });

      // Build summary message
      const score1Criteria = session.extractedData.criteria.filter(c => c.score === 1);
      const fudSummary = fudCandidates
        .map((f, i) => `${i + 1}. **${f.source}** (${f.signal_strength})\n   ${f.weakness_summary}`)
        .join('\n');

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "complete",
          message: `**Step 5 of 5 — Complete**\n\nForrester Wave extraction for **${session.extractedData.vendor_name}** is complete.\n\n**Summary:**\n- Wave placement: ${session.extractedData.wave_placement}\n- Customer feedback: ${session.extractedData.customer_feedback_halo}\n- Current Offering: ${session.extractedData.current_offering_composite}\n- Strategy: ${session.extractedData.strategy_composite}\n- Criteria captured: ${session.extractedData.criteria.length}\n- Criteria scoring 1 (below par): ${score1Criteria.length}\n- Confidence score: ${session.extractedData.pmm_confidence_score}/5\n\n**FUD Candidates Identified (${fudCandidates.length}):**\n${fudSummary || "None identified"}\n\nAll data has been saved. Ready for the next vendor or competitor research.`,
          extractedData: session.extractedData,
          fudCandidates
        })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Invalid mode. Use: start_extraction, process_score_table, process_wave_graphic, process_vendor_profile, submit_pmm_review, submit_confidence_score"
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};