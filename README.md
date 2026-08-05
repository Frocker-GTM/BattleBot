# BattleBot

**AI-powered competitive battlecard generator, built by Bryan Finfrock (FIN Consulting).**

BattleBot automates the assembly of three-tab competitive battlecards for sales teams — combining live web research, analyst report ingestion (Forrester Wave, Gartner MQ), and customer review analysis into a single, source-linked reference doc. It's built with human-in-the-loop checkpoints at every critical decision point, so a Product Marketing Manager reviews and approves the output at each stage rather than trusting a fully automated pipeline.

🔗 **Live app:** [competitivebattlebot.netlify.app](https://competitivebattlebot.netlify.app)

> This project doubles as a personal promotional site — a working demonstration of an AI-powered SaaS tool, built end-to-end by a Product Marketing Manager as a hands-on GTM/technical portfolio piece.

---

## What it does

Sales teams are constantly asked "how do we compare to X?" — and the answer usually lives in someone's head, an outdated slide, or a Slack thread. BattleBot turns that into a maintainable, structured artifact.

Given a product and a competitor, the agent pipeline moves through:

1. **Product warmup** — capture your product's use cases, ICP, and positioning
2. **Live competitive research** — web search and analyst report ingestion (Forrester Wave, Gartner MQ)
3. **FUD gap analysis** — surface competitive strengths, weaknesses, and discovery angles
4. **Battlecard assembly** — compile everything into the final three-tab card

At every stage, the PMM reviews and approves before the pipeline moves forward — this isn't a black box.

### The three-tab output

| Tab | Purpose |
|---|---|
| **1. Use Cases** | Side-by-side Harvey Ball scoring (0–4) of your product vs. the competitor, per use case, with sub-component breakdowns and rationale |
| **2. Critical Intelligence** | Competitor product overview, analyst quadrant positions, customer review themes (praise/complaints), and a four-quadrant SWOT — informational only, no bias |
| **3. FUD Responses** | Prioritized FUD candidates, each with an Intelligence note, a Discovery Question, and a Recommended Response — written to help reps scope opportunities, not attack competitors |

Every tab includes a call-to-action directing reps back to Product Marketing for deal-specific support.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS v3 |
| Hosting / CI-CD | Netlify (auto-deploys on push to `main`) |
| Serverless functions | Netlify Functions (API key security, async research jobs) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| AI | Anthropic Claude API — agent reasoning, web search tool |

### Architecture at a glance

- Long-running research jobs (web search, analyst extraction, FUD analysis) run as **async background functions** — the frontend kicks off a job, then polls a status endpoint until it completes. This avoids Netlify's synchronous function timeout on slow web-search calls.
- Secrets (Anthropic API key, Supabase service role key) live only in the Netlify dashboard and are never exposed to the browser — all AI calls are proxied through serverless functions.
- Competitor profiles are stored globally and shared across products/battlecards; battlecards themselves are scoped per product–competitor pair, with full version history retained on every update.

---

## Getting started locally

### Prerequisites

- [Node.js](https://nodejs.org/) (includes npm)
- A [Supabase](https://supabase.com/) project
- An [Anthropic API key](https://console.anthropic.com/)
- A [Netlify](https://www.netlify.com/) account (for functions + deployment) and the [Netlify CLI](https://docs.netlify.com/cli/get-started/) if you want to run functions locally

### Setup

```bash
# Clone the repo
git clone https://github.com/Frocker-GTM/BattleBot.git
cd BattleBot

# Install dependencies
npm install
```

Create a `.env` file in the project root (this is already covered by `.gitignore` — never commit it):

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The following are required for the AI pipeline and database writes, and should be set in your **Netlify dashboard** (Site configuration → Environment variables), not committed locally:

```
ANTHROPIC_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Run it

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

> Note: full end-to-end functionality (research, analyst ingestion, FUD generation) depends on the Netlify serverless functions and a configured Supabase schema. Running the frontend alone will render the UI but won't complete AI-powered workflows without functions + a database connected.

---

## Project status

Live and functioning end-to-end as of the most recent build. Confirmed working:

- Full pipeline: Warmup → Research → Analyst → FUD → Assembly → Viewer
- Three-tab battlecard viewer rendering real data (Harvey Ball scoring, analyst positioning, SWOT, FUD)
- Two complete battlecards generated and verified against real competitor data

New user signups are currently disabled while the product stabilizes.

---

## About this project

Built by **Bryan Finfrock**, a Product Marketing Manager and GTM strategist, as both a working competitive intelligence tool and a demonstration of hands-on technical execution. It's part of a broader personal site showcasing product marketing work alongside things actually built and shipped.

- LinkedIn / contact: https://www.linkedin.com/in/bryanfinfrock/
