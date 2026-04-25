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
        report_type: 'gartner_mq',
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
          strength_1_label: null, strength_1_paragraph: null,
          strength_2_label: null, strength_2_paragraph: null,
          strength_3_label: null, strength_3_paragraph: null,
          caution_1_label: null, caution_1_paragraph: null,
          caution_2_label: null, caution_2_paragraph: null,
          caution_3_label: null, caution_3_paragraph: null,
          pmm_context: {},
          fud_candidates: [],
          competitive_overlaps: [],
          pmm_confidence_score: null
        }
      };

      await saveSession(sessionId, sessionState);

      return respond(200, {
        sessionId,
        step: "awaiting_mq_graphic",
        message: `Got it — starting Gartner MQ extraction for **${vendorName}** from the **Magic Quadrant for ${mqName}, ${mqMonth} ${mqYear}**.\n\n**Step 1 of 8 — MQ Graphic**\n\nPlease upload a screenshot of the Magic Quadrant graphic. I need to capture:\n- Which quadrant ${vendorName} sits in\n- Their approximate position on both axes\n\nMake sure vendor name labels are clearly visible.`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: process_mq_graphic
    // ─────────────────────────────────────────────
    if (mode === "process_mq_graphic") {
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
                text: `Analyze this Gartner Magic Quadrant graphic for vendor: ${session.vendorName}

Quadrants: Top-right=Leaders, Top-left=Challengers, Bottom-right=Visionaries, Bottom-left=Niche Players
X-axis = Completeness of Vision (left to right)
Y-axis = Ability to Execute (bottom to top)
Do NOT comment on dot size.

Return ONLY valid JSON:
{
  "mq_quadrant": "Leader|Challenger|Visionary|Niche Player",
  "vision_axis_position": "Far Left|Left|Center|Right|Far Right",
  "execution_axis_position": "Low|Mid-Low|Mid|Mid-High|High",
  "axis_boundary_note": "note if near boundary or null",
  "nearby_vendors": [],
  "confidence": "High|Medium|Low",
  "notes": null
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
          sessionId, step: "mq_graphic_parse_error",
          message: "I had trouble reading the MQ graphic. Please re-upload it with vendor labels clearly visible."
        });
      }

      session.extractedData.mq_quadrant = placementData.mq_quadrant;
      session.extractedData.vision_axis_position = placementData.vision_axis_position;
      session.extractedData.execution_axis_position = placementData.execution_axis_position;
      session.extractedData.axis_boundary_note = placementData.axis_boundary_note;
      session.step = "awaiting_vendor_profile";
      await saveSession(sessionId, session);

      return respond(200, {
        sessionId,
        step: "awaiting_vendor_profile",
        message: `MQ placement captured for **${session.vendorName}**:\n- Quadrant: **${placementData.mq_quadrant}**\n- Completeness of Vision: **${placementData.vision_axis_position}**\n- Ability to Execute: **${placementData.execution_axis_position}**${placementData.axis_boundary_note ? `\n- Note: ${placementData.axis_boundary_note}` : ''}\n\n**Step 2 of 8 — Vendor Profile**\n\nNow please copy and paste the full ${session.vendorName} vendor profile section from the MQ report — opening paragraph through all three Cautions.`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: process_vendor_profile
    // ─────────────────────────────────────────────
    if (mode === "process_vendor_profile") {
      const { profileText } = body;
      const session = await loadSession(sessionId);

      const systemPrompt = `You are a Gartner MQ data extraction specialist.
Parse this vendor profile and extract all sections verbatim.
Return ONLY valid JSON:
{
  "opening_paragraph": "verbatim",
  "strengths": [
    { "label": "bold label", "paragraph": "verbatim paragraph" },
    { "label": "bold label", "paragraph": "verbatim paragraph" },
    { "label": "bold label", "paragraph": "verbatim paragraph" }
  ],
  "cautions": [
    { "label": "bold label", "paragraph": "verbatim paragraph" },
    { "label": "bold label", "paragraph": "verbatim paragraph" },
    { "label": "bold label", "paragraph": "verbatim paragraph" }
  ],
  "parse_notes": null
}
Rules: Extract verbatim. Label is the bold heading before each paragraph.`;

      const result = await callClaude(systemPrompt, profileText);

      let profileData;
      try {
        const raw = result.replace(/```json|```/g, '').trim();
        profileData = JSON.parse(raw);
      } catch(e) {
        return respond(200, {
          sessionId, step: "profile_parse_error",
          message: "I had trouble parsing the vendor profile. Please make sure you copied the full section including opening paragraph, all three Strengths with labels, and all three Cautions with labels."
        });
      }

      session.extractedData.opening_paragraph_verbatim = profileData.opening_paragraph;
      if (profileData.strengths[0]) { session.extractedData.strength_1_label = profileData.strengths[0].label; session.extractedData.strength_1_paragraph = profileData.strengths[0].paragraph; }
      if (profileData.strengths[1]) { session.extractedData.strength_2_label = profileData.strengths[1].label; session.extractedData.strength_2_paragraph = profileData.strengths[1].paragraph; }
      if (profileData.strengths[2]) { session.extractedData.strength_3_label = profileData.strengths[2].label; session.extractedData.strength_3_paragraph = profileData.strengths[2].paragraph; }
      if (profileData.cautions[0]) { session.extractedData.caution_1_label = profileData.cautions[0].label; session.extractedData.caution_1_paragraph = profileData.cautions[0].paragraph; }
      if (profileData.cautions[1]) { session.extractedData.caution_2_label = profileData.cautions[1].label; session.extractedData.caution_2_paragraph = profileData.cautions[1].paragraph; }
      if (profileData.cautions[2]) { session.extractedData.caution_3_label = profileData.cautions[2].label; session.extractedData.caution_3_paragraph = profileData.cautions[2].paragraph; }

      session.reviewQueue = [
        { step: "2", field: "opening_paragraph", label: "Opening Paragraph", type: "opening",
          prompt: `Here is Gartner's opening summary for **${session.vendorName}**:\n\n---\n${profileData.opening_paragraph}\n---\n\nDoes this accurately reflect their current market position? Note any vendor spin or overstated capabilities.` },
        { step: "3", field: "strength_1", label: `Strength 1: "${profileData.strengths[0]?.label}"`, type: "strength",
          prompt: `Here is Gartner's first Strength for **${session.vendorName}**:\n\n---\n**${profileData.strengths[0]?.label}**\n\n${profileData.strengths[0]?.paragraph}\n---\n\nDoes this reflect a real competitive advantage? Does it overlap with your product?` },
        { step: "4", field: "strength_2", label: `Strength 2: "${profileData.strengths[1]?.label}"`, type: "strength",
          prompt: `Here is Gartner's second Strength for **${session.vendorName}**:\n\n---\n**${profileData.strengths[1]?.label}**\n\n${profileData.strengths[1]?.paragraph}\n---\n\nDoes this reflect a real competitive advantage? Does it overlap with your product?` },
        { step: "5", field: "strength_3", label: `Strength 3: "${profileData.strengths[2]?.label}"`, type: "strength",
          prompt: `Here is Gartner's third Strength for **${session.vendorName}**:\n\n---\n**${profileData.strengths[2]?.label}**\n\n${profileData.strengths[2]?.paragraph}\n---\n\nDoes this reflect a real competitive advantage? Does it overlap with your product?` },
        { step: "6", field: "caution_1", label: `Caution 1: "${profileData.cautions[0]?.label}"`, type: "caution",
          prompt: `Here is Gartner's first Caution for **${session.vendorName}**:\n\n---\n**${profileData.cautions[0]?.label}**\n\n${profileData.cautions[0]?.paragraph}\n---\n\nIs this a real weakness? Has it been addressed? Does your product fill this gap?` },
        { step: "7", field: "caution_2", label: `Caution 2: "${profileData.cautions[1]?.label}"`, type: "caution",
          prompt: `Here is Gartner's second Caution for **${session.vendorName}**:\n\n---\n**${profileData.cautions[1]?.label}**\n\n${profileData.cautions[1]?.paragraph}\n---\n\nIs this a real weakness? Has it been addressed? Does your product fill this gap?` },
        { step: "8", field: "caution_3", label: `Caution 3: "${profileData.cautions[2]?.label}"`, type: "caution",
          prompt: `Here is Gartner's third Caution for **${session.vendorName}**:\n\n---\n**${profileData.cautions[2]?.label}**\n\n${profileData.cautions[2]?.paragraph}\n---\n\nIs this a real weakness? Has it been addressed? Does your product fill this gap?` }
      ];

      session.currentReviewIndex = 0;
      session.step = "pmm_review";
      await saveSession(sessionId, session);

      const first = session.reviewQueue[0];
      return respond(200, {
        sessionId, step: "pmm_review",
        reviewField: first.field, reviewType: first.type,
        message: `Profile parsed.\n- Opening paragraph ✓\n- ${profileData.strengths.length} Strengths ✓\n- ${profileData.cautions.length} Cautions ✓\n\nBeginning 8-step PMM review — no scoring or FUD decisions until all steps complete.\n\n**Step ${first.step} of 8 — ${first.label}**\n\n${first.prompt}`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: submit_pmm_review
    // ─────────────────────────────────────────────
    if (mode === "submit_pmm_review") {
      const session = await loadSession(sessionId);
      const current = session.reviewQueue[session.currentReviewIndex];

      session.extractedData.pmm_context[current.field] = {
        response: pmmResponse, type: current.type, label: current.label
      };

      if (current.type === "strength" && pmmResponse &&
          (pmmResponse.toLowerCase().includes("we ") ||
           pmmResponse.toLowerCase().includes("our ") ||
           pmmResponse.toLowerCase().includes("overlap"))) {
        session.extractedData.competitive_overlaps.push({
          field: current.field, label: current.label, pmm_note: pmmResponse
        });
      }

      session.currentReviewIndex += 1;

      if (session.currentReviewIndex < session.reviewQueue.length) {
        const next = session.reviewQueue[session.currentReviewIndex];
        await saveSession(sessionId, session);
        return respond(200, {
          sessionId, step: "pmm_review",
          reviewField: next.field, reviewType: next.type,
          message: `Context noted. Moving on.\n\n**Step ${next.step} of 8 — ${next.label}**\n\n${next.prompt}`
        });
      }

      session.step = "awaiting_confidence_score";
      await saveSession(sessionId, session);
      return respond(200, {
        sessionId, step: "awaiting_confidence_score",
        message: `All 8 review steps complete.\n\n**Confidence Score**\n\nOn a scale of 1-5, how credible and relevant is this MQ for this analysis?\n- **5** — Highly current, exact category match\n- **4** — Good, minor gaps\n- **3** — Moderate, 1-2 years old or adjacent\n- **2** — Low credibility\n- **1** — Reference only\n\nPlease enter a score 1-5 and click Submit.`
      });
    }

    // ─────────────────────────────────────────────
    // MODE: submit_confidence_score
    // ─────────────────────────────────────────────
    if (mode === "submit_confidence_score") {
      const { confidenceScore } = body;
      const session = await loadSession(sessionId);

      session.extractedData.pmm_confidence_score = parseInt(confidenceScore);

      const cautionsSummary = [
        session.extractedData.caution_1_label ? `Caution 1 — ${session.extractedData.caution_1_label}: ${session.extractedData.caution_1_paragraph}` : null,
        session.extractedData.caution_2_label ? `Caution 2 — ${session.extractedData.caution_2_label}: ${session.extractedData.caution_2_paragraph}` : null,
        session.extractedData.caution_3_label ? `Caution 3 — ${session.extractedData.caution_3_label}: ${session.extractedData.caution_3_paragraph}` : null,
      ].filter(Boolean).join('\n\n');

      const pmmCautionContext = [
        session.extractedData.pmm_context.caution_1?.response,
        session.extractedData.pmm_context.caution_2?.response,
        session.extractedData.pmm_context.caution_3?.response,
      ].filter(Boolean).join('\n');

      // Extract structured fields from opening paragraph
      const openingResult = await callClaude(
        `Extract structured fields from this vendor opening paragraph. Return ONLY valid JSON:
{
  "geographic_focus": "primary regions",
  "target_customer_size": "SMB|Midsize|Enterprise|All",
  "target_industries": "comma-separated industries",
  "recent_innovations_summary": "brief summary",
  "roadmap_direction": "brief summary"
}`,
        session.extractedData.opening_paragraph_verbatim || ""
      );

      let openingFields = {};
      try {
        openingFields = JSON.parse(openingResult.replace(/```json|```/g, '').trim());
      } catch(e) {}

      session.extractedData.geographic_focus = openingFields.geographic_focus || null;
      session.extractedData.target_customer_size = openingFields.target_customer_size || null;
      session.extractedData.target_industries = openingFields.target_industries || null;
      session.extractedData.recent_innovations_summary = openingFields.recent_innovations_summary || null;
      session.extractedData.roadmap_direction = openingFields.roadmap_direction || null;

      // FUD analysis
      const fudResult = await callClaude(
        `You are a competitive intelligence analyst. Identify FUD candidates from these Gartner MQ Cautions.
Prioritize where PMM context confirms the weakness is real and unresolved.

Cautions:
${cautionsSummary}

PMM context:
${pmmCautionContext || "None provided"}

Return JSON array, max 5 items:
[{ "source": "Caution label", "signal_strength": "Strong|Moderate", "weakness_summary": "brief description", "fud_angle": "how competitor uses this", "pmm_confirmed": true|false }]`,
        "Identify FUD candidates."
      );

      let fudCandidates = [];
      try {
        fudCandidates = JSON.parse(fudResult.replace(/```json|```/g, '').trim());
      } catch(e) {}

      session.extractedData.fud_candidates = fudCandidates;
      session.step = "complete";
      await saveSession(sessionId, session);

      await supabase.from('research_results').insert({
        job_id: `gartner_${session.extractedData.vendor_name}_${Date.now()}`.replace(/\s+/g, '_').toLowerCase(),
        mode: 'analyst_gartner',
        competitor: session.extractedData.vendor_name,
        product_name: session.extractedData.product_name || session.extractedData.vendor_name,
        result: JSON.stringify(session.extractedData),
        status: 'complete'
      });

      const fudSummary = fudCandidates
        .map((f, i) => `${i + 1}. **${f.source}** (${f.signal_strength}${f.pmm_confirmed ? ' — PMM confirmed ✓' : ''})\n   ${f.weakness_summary}`)
        .join('\n');

      const overlapSummary = session.extractedData.competitive_overlaps.length > 0
        ? `\n**Competitive Overlaps (${session.extractedData.competitive_overlaps.length}):**\n${session.extractedData.competitive_overlaps.map(o => `- ${o.label}`).join('\n')}`
        : '';

      return respond(200, {
        sessionId, step: "complete",
        message: `**Complete — Gartner MQ extraction for ${session.extractedData.vendor_name}**\n\n**Placement:**\n- Quadrant: ${session.extractedData.mq_quadrant}\n- Vision: ${session.extractedData.vision_axis_position}\n- Execution: ${session.extractedData.execution_axis_position}\n\n**Profile:**\n- Geography: ${session.extractedData.geographic_focus || 'See opening paragraph'}\n- Customer: ${session.extractedData.target_customer_size}\n- Industries: ${session.extractedData.target_industries}\n\n**Confidence:** ${session.extractedData.pmm_confidence_score}/5\n\n**FUD Candidates (${fudCandidates.length}):**\n${fudSummary || "None identified"}${overlapSummary}\n\nAll data saved.`,
        extractedData: session.extractedData,
        fudCandidates
      });
    }

    return respond(400, {
      error: "Invalid mode. Use: start_extraction, process_mq_graphic, process_vendor_profile, submit_pmm_review, submit_confidence_score"
    });

  } catch (error) {
    return respond(200, {
      debug_error: error.message,
      debug_stack: error.stack,
      debug_mode: body ? body.mode : "unknown"
    });
  }
};