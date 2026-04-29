exports.handler = async function(event, context) {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { mode, formData, messages, competitor, productName } = body;

    // Helper function for Anthropic API calls
    async function callClaude(systemPrompt, userMessage, useWebSearch = false) {
      const requestBody = {
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      };

      if (useWebSearch) {
        requestBody.tools = [{ type: "web_search_20250305", name: "web_search" }];
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));

      const textContent = data.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("\n");

      return textContent;
    }

    // MODE 1: Warmup start (Build 2)
    if (mode === "warmup_start") {
      const systemPrompt = `You are a competitive intelligence assistant helping a 
Product Marketing Manager (PMM) build a competitive battlecard.

You have just received the following product baseline information from the PMM:

PRODUCT NAME: ${formData.productName}
CATEGORY: ${formData.productCategory}
DESCRIPTION: ${formData.productDescription}
INDUSTRY: ${formData.industry}
IDEAL CUSTOMER PROFILE: ${formData.icp}
KNOWN STRENGTHS: ${formData.strengths}

Your job is to now guide the PMM through defining their use cases and positioning.
Follow these rules strictly:
- Use cases must be expressed as customer PROBLEMS and SOLUTIONS, not features
- Ask for one use case at a time
- After collecting 2-3 use cases, move on to positioning statement
- After positioning, present a full warmup summary and ask for confirmation
- Be conversational but structured
- Keep responses concise and focused

Start by acknowledging the product info received, then ask for the first use case.
Frame it like this: "What is the primary problem your customers face that [product] solves?"`;

      const result = await callClaude(systemPrompt,
        "I have submitted my product baseline information. Please begin the warmup conversation."
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: "warmup_conversation",
          message: result,
          conversationHistory: [
            { role: "user", content: "I have submitted my product baseline information. Please begin the warmup conversation." },
            { role: "assistant", content: result }
          ]
        })
      };
    }

    // MODE 2: Warmup continue (Build 2)
    if (mode === "warmup_continue") {
      const systemPrompt = `You are a competitive intelligence assistant helping a 
Product Marketing Manager (PMM) build a competitive battlecard.

Your job is to guide the PMM through defining their use cases and positioning.
Follow these rules strictly:
- Use cases must be expressed as customer PROBLEMS and SOLUTIONS, not features
- Collect 2-3 use cases total, asking for one at a time
- After collecting use cases, ask for the positioning statement
- After positioning, present a complete warmup summary with ALL information collected
- End the summary with: "Does this accurately reflect your product? Please confirm 
  or let me know what needs to be corrected."
- Be conversational but structured
- Keep responses concise and focused`;

      const requestBody = {
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages
      };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      if (!response.ok) return { statusCode: 200, body: JSON.stringify({ debug: data }) };

      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: "warmup_conversation",
          message: data.content[0].text,
          conversationHistory: [
            ...messages,
            { role: "assistant", content: data.content[0].text }
          ]
        })
      };
    }

    // MODE 3: Save warmup to database (Build 7)
    if (mode === "save_warmup") {
      const { conversationHistory, formData: warmupFormData } = body;

      // Use Claude to extract structured data from the completed warmup conversation
      const extractionPrompt = `You are extracting structured data from a completed warmup conversation.

Review the conversation below and extract the following fields as a JSON object:
- use_cases: array of objects, each with "problem" (string) and "solution" (string)
- positioning: string — the positioning statement the PMM confirmed

Return ONLY a valid JSON object with these two fields. No preamble, no markdown, no explanation.

Conversation:
${JSON.stringify(conversationHistory)}`;

      const extractionResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: extractionPrompt }]
        })
      });

      const extractionData = await extractionResponse.json();
      if (!extractionResponse.ok) throw new Error(JSON.stringify(extractionData));

      let extracted;
      try {
        const rawText = extractionData.content[0].text.replace(/```json|```/g, "").trim();
        extracted = JSON.parse(rawText);
      } catch (parseError) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Failed to parse extracted warmup data", raw: extractionData.content[0].text })
        };
      }

      // Write to Supabase user_products
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const insertPayload = {
        product_name: warmupFormData.productName,
        category: warmupFormData.productCategory,
        description: warmupFormData.productDescription,
        industry: warmupFormData.industry,
        icp: warmupFormData.icp,
        strengths: warmupFormData.strengths,
        key_differentiators: warmupFormData.differentiators || null,
        use_cases: extracted.use_cases,
        positioning: extracted.positioning,
        user_id: body.userId || null
      };

      const { data: insertedRow, error: insertError } = await supabase
        .from('user_products')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertError) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: insertError.message })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: "warmup_saved",
          product_id: insertedRow.id,
          message: "Product profile saved successfully.",
          saved: insertPayload
        })
      };
    }

    // MODE 4: Resolve review taxonomy (Build 3)
    if (mode === "resolve_taxonomy") {
      const systemPrompt = `You are a competitive intelligence assistant specializing 
in software review platforms.

Your job is to help identify the EXACT product listing for a competitor on G2, 
Gartner Peer Insights, and TrustRadius before pulling any review data.

This is critical for umbrella vendors like Salesforce, Adobe, or Microsoft where 
a single company has many separate product listings. Pulling reviews at the company 
level instead of the product level will mix unrelated data and corrupt the analysis.

Rules:
- Always ask the PMM to confirm the specific product name before proceeding
- Suggest the most likely review category and listing URL for each platform
- Flag ambiguous cases clearly
- If you are not confident in the correct listing, say so and ask for PMM guidance
- Do not proceed to research until the PMM confirms the correct listings`;

      const result = await callClaude(systemPrompt,
        `I need to research reviews for this competitor:
Company: ${competitor}
Specific Product: ${productName}

Please identify the correct review listings on G2, Gartner Peer Insights, 
and TrustRadius for this specific product, and flag any ambiguity before 
we proceed to research.`
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: "taxonomy_resolution",
          message: result,
          conversationHistory: [
            { role: "user", content: `I need to research reviews for: Company: ${competitor}, Product: ${productName}` },
            { role: "assistant", content: result }
          ]
        })
      };
    }

    // MODE 4: Search G2 reviews only (Build 3 - split)
    if (mode === "research_g2") {
      const systemPrompt = `You are a competitive intelligence researcher focused 
on G2 software reviews.

Search G2 for reviews of the specific product provided. Return ONLY:
- Overall G2 rating and approximate review count
- Top 3 praise themes with 1 representative quote each
- Top 3 complaint themes with 1 representative quote each
- Source URL

Rules:
- Be factual and neutral — no editorial commentary
- Attribute every quote to G2 as the source
- Note the approximate date range of reviews where available
- If you cannot find the specific product listing, say so clearly
- Keep response focused and concise`;

      const result = await callClaude(
        systemPrompt,
        `Search G2 for reviews of: ${competitor} ${productName}
Return structured review intelligence with source attribution.`,
        true
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ mode: "g2_complete", source: "G2", result })
      };
    }

    // MODE 5: Search TrustRadius reviews only (Build 3 - split)
    if (mode === "research_trustradius") {
      const systemPrompt = `You are a competitive intelligence researcher focused 
on TrustRadius software reviews.

Search TrustRadius for reviews of the specific product provided. Return ONLY:
- Overall TrustRadius rating and approximate review count
- Top 3 praise themes with 1 representative quote each
- Top 3 complaint themes with 1 representative quote each
- Source URL

Rules:
- Be factual and neutral — no editorial commentary
- Attribute every quote to TrustRadius as the source
- Note the approximate date range of reviews where available
- If you cannot find the specific product listing, say so clearly
- Keep response focused and concise`;

      const result = await callClaude(
        systemPrompt,
        `Search TrustRadius for reviews of: ${competitor} ${productName}
Return structured review intelligence with source attribution.`,
        true
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ mode: "trustradius_complete", source: "TrustRadius", result })
      };
    }

    // MODE 6: Search Gartner Peer Insights reviews only (Build 3 - split)
    if (mode === "research_gartner_peers") {
      const systemPrompt = `You are a competitive intelligence researcher focused 
on Gartner Peer Insights software reviews.

Search Gartner Peer Insights for reviews of the specific product provided. Return ONLY:
- Overall Gartner Peer Insights rating and approximate review count
- Top 3 praise themes with 1 representative quote each
- Top 3 complaint themes with 1 representative quote each
- Source URL and Gartner market category

Rules:
- Be factual and neutral — no editorial commentary
- Attribute every quote to Gartner Peer Insights as the source
- Note the approximate date range of reviews where available
- If you cannot find the specific product listing, say so clearly
- Keep response focused and concise`;

      const result = await callClaude(
        systemPrompt,
        `Search Gartner Peer Insights for reviews of: ${competitor} ${productName}
Return structured review intelligence with source attribution.`,
        true
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ mode: "gartner_peers_complete", source: "Gartner Peer Insights", result })
      };
    }

    // MODE 7: Search competitor website and marketing materials (Build 3 - split)
    if (mode === "research_website") {
      const systemPrompt = `You are a competitive intelligence researcher focused 
on competitor positioning and marketing analysis.

Search the competitor's website and marketing materials. Return ONLY:
- Current value proposition and tagline
- Self-proclaimed strengths and differentiators
- Ideal customer profile as described by the competitor
- Known pricing and packaging (note if not publicly disclosed)
- Any recent product announcements or strategic shifts
- Source URLs for every claim

Rules:
- Be factual and neutral — no editorial commentary
- Quote the competitor's own language where possible
- Attribute every claim to a specific source URL
- Note the date of each source where available
- Keep response focused and concise`;

      const result = await callClaude(
        systemPrompt,
        `Search the website and marketing materials for: ${competitor} ${productName}
Return structured competitive intelligence with source attribution.`,
        true
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ mode: "website_complete", source: "Competitor Website", result })
      };
    }

    // MODE 8: Original competitor overview (Build 1 preserved)
    if (mode === "competitor_overview") {
      const result = await callClaude(
        "You are a competitive intelligence assistant.",
        `Give me a one paragraph overview of this competitor: ${competitor}`
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ result })
      };
    }

    // MODE 9: Create research job and trigger background function
    if (mode === "create_research_job") {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Generate a unique job ID
      const job_id = `${mode}_${competitor}_${productName}_${Date.now()}`
        .replace(/\s+/g, '_')
        .toLowerCase();

      // Create the job row in Supabase
      const { error } = await supabase
        .from('research_results')
        .insert({
          job_id,
          mode: body.researchMode,
          competitor,
          product_name: productName,
          competitor_id: body.competitorId || null,
          status: 'pending'
        });

      if (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: error.message })
        };
      }

      // Trigger the background function with await
      const bgUrl = `${process.env.URL}/.netlify/functions/research-background`;
      await fetch(bgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id,
          mode: body.researchMode,
          competitor,
          productName,
          competitorId: body.competitorId || null
        })
      });

      // Return immediately with the job ID
      return {
        statusCode: 200,
        body: JSON.stringify({
          job_id,
          status: 'pending',
          message: `Research job created. Poll /research-status with job_id to check progress.`
        })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Invalid mode. Use: warmup_start, warmup_continue, save_warmup, resolve_taxonomy, research_g2, research_trustradius, research_gartner_peers, research_website, create_research_job, or competitor_overview"
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};