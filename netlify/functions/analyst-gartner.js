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
    const { mode, sessionId, pmmResponse } = body;

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
          report_type: 'gartner_mq',
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
    // PMM provides: MQ metadata + vendor name
    // Agent confirms receipt, asks for MQ graphic
    // ─────────────────────────────────────────────
    if (mode === "start_extraction") {
      const { mqName, mqMonth, mqYear, analystNames, gartnerReportId, vendorName, productName } = body;

      const sessionState = {
        step: "awaiting_mq_graphic",
        mqName, mqMonth, mqYear, analystNames,
        gartnerReportId, vendorName, productName,
        extractedData: {
          report_type: "Gartner Magic Quadrant",
          mq_name: mqName,
          mq_month: mqMonth,
          mq_year: mqYear,
          analyst_names: analystNames || null,
          gartner_report_id: gartnerReportId || null,
          vendor_name: vendorName,
          product_name: productName || null,
          extraction_date: new Date().toISOString().split('T')[0],
          mq_quadrant: null,
          vision_axis_position: null,
          execution_axis_position: null,
          axis_boundary_note: null,
          opening_paragraph_verbatim: null,
          geographic_focus: null,
          target_customer_size: null,
          target_industries: null,
          recent_innovations_summary: null,
          roadmap_direction: null,
          icp_overlap_with_your_target: null,
          strength_1_label: null,
          strength_1_paragraph: null,
          strength_2_label: null,
          strength_2_paragraph: null,
          strength_3_label: null,
          strength_3_paragraph: null,
          caution_1_label: null,
          caution_1_paragraph: null,
          caution_2_label: null,
          caution_2_paragraph: null,
          caution_3_label: null,
          caution_3_paragraph: null,
          pmm_context: {},
          fud_candidates: [],
          competitive_overlaps: [],
          pmm_confidence_score: null
        }
      };

      await saveSession(sessionId, sessionState);

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "awaiting_mq_graphic",
          message: `Got it — starting Gartner MQ extraction for **${vendorName}** from the **Magic Quadrant for ${mqName}, ${mqMonth} ${mqYear}**.\n\n**Step 1 of 8 — MQ Graphic**\n\nPlease upload a screenshot of the Magic Quadrant graphic (the four-quadrant chart). I need to capture:\n- Which quadrant ${vendorName} sits in\n- Their approximate position on both axes within that quadrant\n\nMake sure the vendor name labels are clearly visible in the screenshot.`
        })
      };
    }

    // ─────────────────────────────────────────────
    // MODE: process_mq_graphic
    // PMM provides: MQ graphic image (as base64)
    // Agent extracts quadrant + axis position
    // ─────────────────────────────────────────────
    if (mode === "process_mq_graphic") {
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
                text: `Analyze this Gartner Magic Quadrant graphic for vendor: ${session.vendorName}

The four quadrants are:
- Top-right: Leaders (high Ability to Execute, high Completeness of Vision)
- Top-left: Challengers (high Ability to Execute, low Completeness of Vision)
- Bottom-right: Visionaries (low Ability to Execute, high Completeness of Vision)
- Bottom-left: Niche Players (low Ability to Execute, low Completeness of Vision)

X-axis = Completeness of Vision (left to right)
Y-axis = Ability to Execute (bottom to top)

DO NOT capture or comment on dot size.

Return ONLY valid JSON:
{
  "mq_quadrant": "Leader|Challenger|Visionary|Niche Player",
  "vision_axis_position": "Far Left|Left|Center|Right|Far Right",
  "execution_axis_position": "Low|Mid-Low|Mid|Mid-High|High",
  "axis_boundary_note": "note if near boundary or null",
  "nearby_vendors": ["list any vendors that appear very close to this vendor"],
  "confidence": "High|Medium|Low",
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
        return {
          statusCode: 200,
          body: JSON.stringify({
            sessionId, step: "mq_graphic_parse_error",
            message: "I had trouble reading the MQ graphic. Could you re-upload it? Make sure all four quadrant labels and vendor name labels are visible."
          })
        };
      }

      session.extractedData.mq_quadrant = placementData.mq_quadrant;
      session.extractedData.vision_axis_position = placementData.vision_axis_position;
      session.extractedData.execution_axis_position = placementData.execution_axis_position;
      session.extractedData.axis_boundary_note = placementData.axis_boundary_note;
      session.step = "awaiting_vendor_profile";
      await saveSession(sessionId, session);

      const nearbyNote = placementData.nearby_vendors && placementData.nearby_vendors.length > 0
        ? `\n- Close competitors: ${placementData.nearby_vendors.join(', ')}`
        : '';

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "awaiting_vendor_profile",
          message: `MQ placement captured for **${session.vendorName}**:\n- Quadrant: **${placementData.mq_quadrant}**\n- Completeness of Vision: **${placementData.vision_axis_position}**\n- Ability to Execute: **${placementData.execution_axis_position}**${placementData.axis_boundary_note ? `\n- Note: ${placementData.axis_boundary_note}` : ''}${nearbyNote}\n\n**Step 2 of 8 — Vendor Profile**\n\nNow please copy and paste the full ${session.vendorName} vendor profile section from the MQ report. This should include:\n- The opening paragraph\n- All three Strengths (each with bold label + paragraph)\n- All three Cautions (each with bold label + paragraph)\n\nCopy everything from the vendor name heading through the last Caution paragraph.`
        })
      };
    }

    // ─────────────────────────────────────────────
    // MODE: process_vendor_profile
    // PMM provides: copy/pasted vendor profile text
    // Agent parses into opening + 3 strengths + 3 cautions
    // Then begins 8-step PMM review sequence
    // ─────────────────────────────────────────────
    if (mode === "process_vendor_profile") {
      const { profileText } = body;
      const session = await loadSession(sessionId);
      if (!session) return { statusCode: 400, body: JSON.stringify({ error: "Session not found" }) };

      const systemPrompt = `You are a Gartner Magic Quadrant data extraction specialist.
Parse the following vendor profile and extract all sections verbatim.

Return ONLY valid JSON:
{
  "opening_paragraph": "full opening paragraph verbatim",
  "strengths": [
    { "label": "bold label text", "paragraph": "full paragraph verbatim" },
    { "label": "bold label text", "paragraph": "full paragraph verbatim" },
    { "label": "bold label text", "paragraph": "full paragraph verbatim" }
  ],
  "cautions": [
    { "label": "bold label text", "paragraph": "full paragraph verbatim" },
    { "label": "bold label text", "paragraph": "full paragraph verbatim" },
    { "label": "bold label text", "paragraph": "full paragraph verbatim" }
  ],
  "parse_notes": "any issues finding sections or null"
}

Important rules:
- Extract verbatim — do not summarize or paraphrase
- The label is the bold heading before each paragraph
- If fewer than 3 strengths or cautions are found, include what exists and note it in parse_notes
- Opening paragraph ends before the word 'Strengths'`;

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
            message: "I had trouble parsing the vendor profile. Please make sure you've copied the full section including the opening paragraph, all three Strengths with their labels, and all three Cautions with their labels."
          })
        };
      }

      // Store all extracted data
      session.extractedData.opening_paragraph_verbatim = profileData.opening_paragraph;
      if (profileData.strengths[0]) {
        session.extractedData.strength_1_label = profileData.strengths[0].label;
        session.extractedData.strength_1_paragraph = profileData.strengths[0].paragraph;
      }
      if (profileData.strengths[1]) {
        session.extractedData.strength_2_label = profileData.strengths[1].label;
        session.extractedData.strength_2_paragraph = profileData.strengths[1].paragraph;
      }
      if (profileData.strengths[2]) {
        session.extractedData.strength_3_label = profileData.strengths[2].label;
        session.extractedData.strength_3_paragraph = profileData.strengths[2].paragraph;
      }
      if (profileData.cautions[0]) {
        session.extractedData.caution_1_label = profileData.cautions[0].label;
        session.extractedData.caution_1_paragraph = profileData.cautions[0].paragraph;
      }
      if (profileData.cautions[1]) {
        session.extractedData.caution_2_label = profileData.cautions[1].label;
        session.extractedData.caution_2_paragraph = profileData.cautions[1].paragraph;
      }
      if (profileData.cautions[2]) {
        session.extractedData.caution_3_label = profileData.cautions[2].label;
        session.extractedData.caution_3_paragraph = profileData.cautions[2].paragraph;
      }

      // Build the 8-step review queue
      session.reviewQueue = [
        {
          step: "2",
          field: "opening_paragraph",
          label: "Opening Paragraph",
          type: "opening",
          text: profileData.opening_paragraph,
          prompt: `Here is Gartner's opening summary for **${session.vendorName}**:\n\n---\n${profileData.opening_paragraph}\n---\n\nDoes this accurately reflect their current market position and product? Note any framing that seems influenced by vendor spin or that overstates their capabilities.`
        },
        {
          step: "3",
          field: "strength_1",
          label: `Strength 1: "${profileData.strengths[0]?.label || 'N/A'}"`,
          type: "strength",
          text: profileData.strengths[0] ? `**${profileData.strengths[0].label}**\n\n${profileData.strengths[0].paragraph}` : "Not found",
          prompt: `Here is Gartner's first Strength for **${session.vendorName}**:\n\n---\n**${profileData.strengths[0]?.label}**\n\n${profileData.strengths[0]?.paragraph}\n---\n\nDoes this accurately reflect a real competitive advantage? Please share any context from the field that confirms, contradicts, or adds nuance — and note if this strength overlaps with your own product.`
        },
        {
          step: "4",
          field: "strength_2",
          label: `Strength 2: "${profileData.strengths[1]?.label || 'N/A'}"`,
          type: "strength",
          text: profileData.strengths[1] ? `**${profileData.strengths[1].label}**\n\n${profileData.strengths[1].paragraph}` : "Not found",
          prompt: `Here is Gartner's second Strength for **${session.vendorName}**:\n\n---\n**${profileData.strengths[1]?.label}**\n\n${profileData.strengths[1]?.paragraph}\n---\n\nDoes this accurately reflect a real competitive advantage? Please share any context that confirms, contradicts, or adds nuance — and note if this overlaps with your product.`
        },
        {
          step: "5",
          field: "strength_3",
          label: `Strength 3: "${profileData.strengths[2]?.label || 'N/A'}"`,
          type: "strength",
          text: profileData.strengths[2] ? `**${profileData.strengths[2].label}**\n\n${profileData.strengths[2].paragraph}` : "Not found",
          prompt: `Here is Gartner's third Strength for **${session.vendorName}**:\n\n---\n**${profileData.strengths[2]?.label}**\n\n${profileData.strengths[2]?.paragraph}\n---\n\nDoes this accurately reflect a real competitive advantage? Please share any context that confirms, contradicts, or adds nuance — and note if this overlaps with your product.`
        },
        {
          step: "6",
          field: "caution_1",
          label: `Caution 1: "${profileData.cautions[0]?.label || 'N/A'}"`,
          type: "caution",
          text: profileData.cautions[0] ? `**${profileData.cautions[0].label}**\n\n${profileData.cautions[0].paragraph}` : "Not found",
          prompt: `Here is Gartner's first Caution for **${session.vendorName}**:\n\n---\n**${profileData.cautions[0]?.label}**\n\n${profileData.cautions[0]?.paragraph}\n---\n\nDoes this accurately reflect a real weakness? Please share any context from deals or the field that confirms, contradicts, or adds nuance. Has this weakness been addressed since publication? Does your product directly address this gap?`
        },
        {
          step: "7",
          field: "caution_2",
          label: `Caution 2: "${profileData.cautions[1]?.label || 'N/A'}"`,
          type: "caution",
          text: profileData.cautions[1] ? `**${profileData.cautions[1].label}**\n\n${profileData.cautions[1].paragraph}` : "Not found",
          prompt: `Here is Gartner's second Caution for **${session.vendorName}**:\n\n---\n**${profileData.cautions[1]?.label}**\n\n${profileData.cautions[1]?.paragraph}\n---\n\nDoes this accurately reflect a real weakness? Has this been addressed since publication? Does your product directly address this gap?`
        },
        {
          step: "8",
          field: "caution_3",
          label: `Caution 3: "${profileData.cautions[2]?.label || 'N/A'}"`,
          type: "caution",
          text: profileData.cautions[2] ? `**${profileData.cautions[2].label}**\n\n${profileData.cautions[2].paragraph}` : "Not found",
          prompt: `Here is Gartner's third Caution for **${session.vendorName}**:\n\n---\n**${profileData.cautions[2]?.label}**\n\n${profileData.cautions[2]?.paragraph}\n---\n\nDoes this accurately reflect a real weakness? Has this been addressed since publication? Does your product directly address this gap?`
        }
      ];

      session.currentReviewIndex = 0;
      session.step = "pmm_review";
      await saveSession(sessionId, session);

      const first = session.reviewQueue[0];

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "pmm_review",
          reviewField: first.field,
          reviewType: first.type,
          message: `Profile parsed successfully.\n\nFound:\n- Opening paragraph ✓\n- ${profileData.strengths.length} Strengths ✓\n- ${profileData.cautions.length} Cautions ✓\n${profileData.parse_notes ? `\nNote: ${profileData.parse_notes}\n` : ''}\nNow beginning the 8-step PMM review. I will present each section verbatim — no scoring or FUD decisions until all steps are complete.\n\n**Step ${first.step} of 8 — ${first.label}**\n\n${first.prompt}`
        })
      };
    }

    // ─────────────────────────────────────────────
    // MODE: submit_pmm_review
    // PMM provides: their response to current review step
    // Agent stores context, advances to next step
    // ─────────────────────────────────────────────
    if (mode === "submit_pmm_review") {
      const session = await loadSession(sessionId);
      if (!session) return { statusCode: 400, body: JSON.stringify({ error: "Session not found" }) };

      const current = session.reviewQueue[session.currentReviewIndex];

      // Store PMM context
      session.extractedData.pmm_context[current.field] = {
        response: pmmResponse,
        type: current.type,
        label: current.label
      };

      // Flag competitive overlaps from strengths
      if (current.type === "strength" &&
          pmmResponse.toLowerCase().includes("we") ||
          pmmResponse.toLowerCase().includes("our") ||
          pmmResponse.toLowerCase().includes("overlap")) {
        session.extractedData.competitive_overlaps.push({
          field: current.field,
          label: current.label,
          pmm_note: pmmResponse
        });
      }

      session.currentReviewIndex += 1;

      // More reviews to go
      if (session.currentReviewIndex < session.reviewQueue.length) {
        const next = session.reviewQueue[session.currentReviewIndex];
        await saveSession(sessionId, session);

        return {
          statusCode: 200,
          body: JSON.stringify({
            sessionId,
            step: "pmm_review",
            reviewField: next.field,
            reviewType: next.type,
            message: `Context noted. Moving on.\n\n**Step ${next.step} of 8 — ${next.label}**\n\n${next.prompt}`
          })
        };
      }

      // All 8 review steps complete — ask for confidence score
      session.step = "awaiting_confidence_score";
      await saveSession(sessionId, session);

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "awaiting_confidence_score",
          message: `Context noted for ${current.label}. All 8 review steps complete.\n\n**Step 8 of 8 — Confidence Score**\n\nOn a scale of 1-5, how would you rate the credibility and relevance of this MQ for this analysis?\n\n- **5** — Highly current and directly relevant (published within 12 months, exact category match)\n- **4** — Good report with minor timing or category gaps\n- **3** — Moderate — 1-2 years old or adjacent category\n- **2** — Low credibility — significantly dated or tangential\n- **1** — Reference only — do not use for scoring\n\nPlease reply with a number 1-5.`
        })
      };
    }

    // ─────────────────────────────────────────────
    // MODE: submit_confidence_score
    // PMM provides: confidence score 1-5
    // Agent runs FUD + ICP analysis, completes extraction
    // ─────────────────────────────────────────────
    if (mode === "submit_confidence_score") {
      const { confidenceScore } = body;
      const session = await loadSession(sessionId);
      if (!session) return { statusCode: 400, body: JSON.stringify({ error: "Session not found" }) };

      session.extractedData.pmm_confidence_score = parseInt(confidenceScore);

      // Build cautions summary for FUD analysis
      const cautionsSummary = [
        session.extractedData.caution_1_label ? `Caution 1 — ${session.extractedData.caution_1_label}: ${session.extractedData.caution_1_paragraph}` : null,
        session.extractedData.caution_2_label ? `Caution 2 — ${session.extractedData.caution_2_label}: ${session.extractedData.caution_2_paragraph}` : null,
        session.extractedData.caution_3_label ? `Caution 3 — ${session.extractedData.caution_3_label}: ${session.extractedData.caution_3_paragraph}` : null,
      ].filter(Boolean).join('\n\n');

      const pmmCautionContext = [
        session.extractedData.pmm_context.caution_1 ? `Caution 1 PMM context: ${session.extractedData.pmm_context.caution_1.response}` : null,
        session.extractedData.pmm_context.caution_2 ? `Caution 2 PMM context: ${session.extractedData.pmm_context.caution_2.response}` : null,
        session.extractedData.pmm_context.caution_3 ? `Caution 3 PMM context: ${session.extractedData.pmm_context.caution_3.response}` : null,
      ].filter(Boolean).join('\n');

      // Extract structured fields from opening paragraph
      const openingSystemPrompt = `Extract structured fields from this vendor opening paragraph.
Return ONLY valid JSON:
{
  "geographic_focus": "primary regions mentioned",
  "target_customer_size": "SMB|Midsize|Enterprise|All",
  "target_industries": "comma-separated list of industries",
  "recent_innovations_summary": "brief summary of recent innovations",
  "roadmap_direction": "brief summary of roadmap priorities"
}`;

      const openingResult = await callClaude(
        openingSystemPrompt,
        session.extractedData.opening_paragraph_verbatim || ""
      );

      let openingFields = {};
      try {
        const raw = openingResult.replace(/```json|```/g, '').trim();
        openingFields = JSON.parse(raw);
      } catch(e) { openingFields = {}; }

      session.extractedData.geographic_focus = openingFields.geographic_focus || null;
      session.extractedData.target_customer_size = openingFields.target_customer_size || null;
      session.extractedData.target_industries = openingFields.target_industries || null;
      session.extractedData.recent_innovations_summary = openingFields.recent_innovations_summary || null;
      session.extractedData.roadmap_direction = openingFields.roadmap_direction || null;

      // Run FUD analysis
      const fudSystemPrompt = `You are a competitive intelligence analyst reviewing a completed Gartner MQ extraction.

Vendor: ${session.extractedData.vendor_name}
MQ: ${session.extractedData.mq_name} ${session.extractedData.mq_month} ${session.extractedData.mq_year}
Quadrant: ${session.extractedData.mq_quadrant}
Vision axis: ${session.extractedData.vision_axis_position}
Execution axis: ${session.extractedData.execution_axis_position}

Cautions from Gartner:
${cautionsSummary}

PMM context on cautions:
${pmmCautionContext || "None provided"}

Based on the above, identify FUD candidates — areas where this vendor has documented weaknesses a competitor could exploit.
Prioritize cautions where PMM context confirms the weakness is real and unresolved.

For each FUD candidate return:
{
  "source": "Caution label",
  "signal_strength": "Strong|Moderate",
  "weakness_summary": "brief neutral description",
  "fud_angle": "how a competitor could use this in a deal",
  "pmm_confirmed": true or false
}

Return as JSON array. Maximum 5 candidates. Strongest signals first.`;

      const fudResult = await callClaude(fudSystemPrompt, "Identify FUD candidates.");

      let fudCandidates = [];
      try {
        const raw = fudResult.replace(/```json|```/g, '').trim();
        fudCandidates = JSON.parse(raw);
      } catch(e) { fudCandidates = []; }

      session.extractedData.fud_candidates = fudCandidates;
      session.step = "complete";
      await saveSession(sessionId, session);

      // Save to research_results
      await supabase
        .from('research_results')
        .insert({
          job_id: `gartner_${session.extractedData.vendor_name}_${Date.now()}`.replace(/\s+/g, '_').toLowerCase(),
          mode: 'analyst_gartner',
          competitor: session.extractedData.vendor_name,
          product_name: session.extractedData.product_name || session.extractedData.vendor_name,
          result: JSON.stringify(session.extractedData),
          status: 'complete'
        });

      // Build summary
      const fudSummary = fudCandidates
        .map((f, i) => `${i + 1}. **${f.source}** (${f.signal_strength}${f.pmm_confirmed ? ' — PMM confirmed ✓' : ''})\n   ${f.weakness_summary}`)
        .join('\n');

      const overlapSummary = session.extractedData.competitive_overlaps.length > 0
        ? `\n**Competitive Overlaps to Prepare Defenses For (${session.extractedData.competitive_overlaps.length}):**\n${session.extractedData.competitive_overlaps.map(o => `- ${o.label}`).join('\n')}`
        : '';

      return {
        statusCode: 200,
        body: JSON.stringify({
          sessionId,
          step: "complete",
          message: `**Complete — Gartner MQ extraction for ${session.extractedData.vendor_name}**\n\n**Placement:**\n- Quadrant: ${session.extractedData.mq_quadrant}\n- Completeness of Vision: ${session.extractedData.vision_axis_position}\n- Ability to Execute: ${session.extractedData.execution_axis_position}\n\n**Profile:**\n- Geographic focus: ${session.extractedData.geographic_focus || 'See opening paragraph'}\n- Target customer: ${session.extractedData.target_customer_size || 'See opening paragraph'}\n- Industries: ${session.extractedData.target_industries || 'See opening paragraph'}\n\n**Confidence score:** ${session.extractedData.pmm_confidence_score}/5\n\n**FUD Candidates Identified (${fudCandidates.length}):**\n${fudSummary || "None identified"}${overlapSummary}\n\nAll data saved. Ready for the next vendor or next research step.`,
          extractedData: session.extractedData,
          fudCandidates,
          competitiveOverlaps: session.extractedData.competitive_overlaps
        })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Invalid mode. Use: start_extraction, process_mq_graphic, process_vendor_profile, submit_pmm_review, submit_confidence_score"
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};