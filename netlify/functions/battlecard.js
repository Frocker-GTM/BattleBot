exports.handler = async function(event, context) {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { mode, formData, messages } = body;

    // MODE 1: Process form data and begin conversation
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

      if (!response.ok) {
        return {
          statusCode: 200,
          body: JSON.stringify({ debug: data })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: "warmup_conversation",
          message: data.content[0].text,
          conversationHistory: [
            {
              role: "user",
              content: "I have submitted my product baseline information. Please begin the warmup conversation."
            },
            {
              role: "assistant",
              content: data.content[0].text
            }
          ]
        })
      };
    }

    // MODE 2: Continue the warmup conversation
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

      if (!response.ok) {
        return {
          statusCode: 200,
          body: JSON.stringify({ debug: data })
        };
      }

      const updatedHistory = [
        ...messages,
        {
          role: "assistant",
          content: data.content[0].text
        }
      ];

      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: "warmup_conversation",
          message: data.content[0].text,
          conversationHistory: updatedHistory
        })
      };
    }

    // MODE 3: Original competitor overview (Build 1 preserved)
    if (mode === "competitor_overview") {
      const { competitor } = body;

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

      if (!response.ok) {
        return {
          statusCode: 200,
          body: JSON.stringify({ debug: data })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          result: data.content[0].text
        })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid mode. Use warmup_start, warmup_continue, or competitor_overview" })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};