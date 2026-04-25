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
    const { job_id, mode, competitor, productName } = JSON.parse(event.body);

    // Update job status to running
    await supabase
      .from('research_results')
      .update({ status: 'running' })
      .eq('job_id', job_id);

    // Build system prompt based on mode
    const prompts = {
      research_g2: {
        system: `You are a competitive intelligence researcher focused on G2 software reviews.
Search G2 for reviews of the specific product provided. Return ONLY:
- Overall G2 rating and approximate review count
- Top 3 praise themes with 1 representative quote each
- Top 3 complaint themes with 1 representative quote each
- Source URL
Rules:
- Be factual and neutral — no editorial commentary
- Attribute every quote to G2 as the source
- Note the approximate date range of reviews where available
- If you cannot find the specific product listing, say so clearly`,
        user: `Search G2 for reviews of: ${competitor} ${productName}. Return structured review intelligence with source attribution.`
      },
      research_trustradius: {
        system: `You are a competitive intelligence researcher focused on TrustRadius software reviews.
Search TrustRadius for reviews of the specific product provided. Return ONLY:
- Overall TrustRadius rating and approximate review count
- Top 3 praise themes with 1 representative quote each
- Top 3 complaint themes with 1 representative quote each
- Source URL
Rules:
- Be factual and neutral — no editorial commentary
- Attribute every quote to TrustRadius as the source
- Note the approximate date range of reviews where available
- If you cannot find the specific product listing, say so clearly`,
        user: `Search TrustRadius for reviews of: ${competitor} ${productName}. Return structured review intelligence with source attribution.`
      },
      research_gartner_peers: {
        system: `You are a competitive intelligence researcher focused on Gartner Peer Insights reviews.
Search Gartner Peer Insights for reviews of the specific product provided. Return ONLY:
- Overall Gartner Peer Insights rating and approximate review count
- Top 3 praise themes with 1 representative quote each
- Top 3 complaint themes with 1 representative quote each
- Source URL and Gartner market category
Rules:
- Be factual and neutral — no editorial commentary
- Attribute every quote to Gartner Peer Insights as the source
- Note the approximate date range of reviews where available
- If you cannot find the specific product listing, say so clearly`,
        user: `Search Gartner Peer Insights for reviews of: ${competitor} ${productName}. Return structured review intelligence with source attribution.`
      },
      research_website: {
        system: `You are a competitive intelligence researcher focused on competitor positioning.
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
- Attribute every claim to a specific source URL`,
        user: `Search the website and marketing materials for: ${competitor} ${productName}. Return structured competitive intelligence with source attribution.`
      }
    };

    const prompt = prompts[mode];
    if (!prompt) {
      await supabase
        .from('research_results')
        .update({ status: 'error', result: 'Invalid research mode' })
        .eq('job_id', job_id);
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid mode' }) };
    }

    // Call Anthropic with web search
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
        system: prompt.system,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt.user }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      await supabase
        .from('research_results')
        .update({ status: 'error', result: JSON.stringify(data) })
        .eq('job_id', job_id);
      return { statusCode: 200, body: JSON.stringify({ error: data }) };
    }

    const textContent = data.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");

    // Save result to Supabase
    await supabase
      .from('research_results')
      .update({ status: 'complete', result: textContent })
      .eq('job_id', job_id);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    await supabase
      .from('research_results')
      .update({ status: 'error', result: error.message })
      .eq('job_id', event.body ? JSON.parse(event.body).job_id : 'unknown');

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};