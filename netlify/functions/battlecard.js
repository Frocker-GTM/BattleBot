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
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: "I have submitted my product baseline information. Please begin the warmup conversation."
            }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) return { statusCode: 200, body: JSON.stringify({ debug: data }) };

      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: "warmup_conversation",
          message: data.content[0].text,
          conversationHistory: [
            { role: "user", content: "I have submitted my product baseline information. Please begin the warmup conversation." },
            { role: "assistant", content: data.content[0].text }
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
          system: systemPrompt,
          messages: messages
        })
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

    // MODE 3: Resolve review taxonomy before searching (Build 3 pre-step)
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
- Flag ambiguous cases clearly — e.g. "Salesforce has 40+ listings on G2"
- If you are not confident in the correct listing, say so and ask for PMM guidance
- Do not proceed to research until the PMM confirms the correct listings`;

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
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `I need to research reviews for this competitor: 
Company: ${competitor}
Specific Product: ${productName}

Please identify the correct review listings on G2, Gartner Peer Insights, 
and TrustRadius for this specific product, and flag any ambiguity before 
we proceed to research.`
            }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) return { statusCode: 200, body: JSON.stringify({ debug: data }) };

      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: "taxonomy_resolution",
          message: data.content[0].text,
          conversationHistory: [
            {
              role: "user",
              content: `I need to research reviews for: Company: ${competitor}, Product: ${productName}`
            },
            { role: "assistant", content: data.content[0].text }
          ]
        })
      };
    }

    // MODE 4: Live research with web search (Build 3)
    if (mode === "research_competitor") {
      const systemPrompt = `You are a competitive intelligence researcher. 
Your job is to research a specific competitor product and return structured 
intelligence across two areas:

1. CUSTOMER REVIEW SENTIMENT
Search G2, Gartner Peer Insights, and TrustRadius for reviews of the 
specific product provided. Return:
- Overall rating and review count per platform
- Top 3 praise themes (what customers love)
- Top 3 complaint themes (what customers hate)
- 1-2 representative quotes per theme where available
- Source attribution for every data point

2. COMPETITOR POSITIONING AND MARKETING
Search the competitor's website and marketing materials. Return:
- Current value proposition and tagline
- Self-proclaimed strengths and differentiators
- Ideal customer profile as described by the competitor
- Known pricing and packaging (note if not publicly disclosed)
- Any recent product announcements or strategic shifts
- Source URLs for every claim

Rules:
- Be factual and neutral — no editorial commentary
- Attribute every claim to a source
- Flag anything that could not be verified
- Note the date of each source where available`;

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
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search"
            }
          ],
          messages: [
            {
              role: "user",
              content: `Research this competitor product:
Company: ${competitor}
Product: ${productName}

Search for customer reviews on G2, Gartner Peer Insights, and TrustRadius,
then search their website and marketing materials.
Return structured intelligence with source attribution for everything.`
            }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) return { statusCode: 200, body: JSON.stringify({ debug: data }) };

      const textContent = data.content
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("\n");

      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: "research_complete",
          result: textContent,
          rawContent: data.content
        })
      };
    }

    // MODE 5: Original competitor overview (Build 1 preserved)
    if (mode === "competitor_overview") {
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
          messages: [
            {
              role: "user",
              content: `You are a competitive intelligence assistant. 
              Give me a one paragraph overview of this competitor: ${competitor}`
            }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) return { statusCode: 200, body: JSON.stringify({ debug: data }) };

      return {
        statusCode: 200,
        body: JSON.stringify({ result: data.content[0].text })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: "Invalid mode. Use warmup_start, warmup_continue, resolve_taxonomy, research_competitor, or competitor_overview" 
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};