import { useEffect } from 'react'

// Google Fonts loader — runs once. If you already load these globally in
// index.html you can delete this effect.
function useFonts() {
  useEffect(() => {
    const id = '__heropitch_fonts'
    if (document.getElementById(id)) return
    const pre1 = document.createElement('link')
    pre1.rel = 'preconnect'
    pre1.href = 'https://fonts.googleapis.com'
    const pre2 = document.createElement('link')
    pre2.rel = 'preconnect'
    pre2.href = 'https://fonts.gstatic.com'
    pre2.crossOrigin = ''
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?' +
      'family=Josefin+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,500&' +
      'family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400&' +
      'family=JetBrains+Mono:wght@400;500&display=swap'
    document.head.append(pre1, pre2, link)
  }, [])
}

export default function HeroPitch() {
  useFonts()

  return (
    <div className="heropitch-page">
      <style>{CSS}</style>

      <div className="page-wrap">
        <article className="poster" data-screen-label="Hero's Pitch Infographic">
          <span className="corner tl"></span>
          <span className="corner tr"></span>
          <span className="corner bl"></span>
          <span className="corner br"></span>

          {/* HEADER */}
          <header className="header">
            <div>
              <div className="eyebrow">Narrative × Sales Framework · Bryan Finfrock</div>
              <h1 className="title">
                The Hero's
                <br />
                <span className="accent">Pitch.</span>
              </h1>
              <p className="subtitle">
                Aligning the SALES PITCH
                <span className="divider"></span>
                <span style={{ letterSpacing: '0.18em' }}>with the NARRATIVE ARC</span>
              </p>
            </div>
            <div className="logo-box">
              <LogoMark />
              <div className="tagline">Insight · Narrative · GTM</div>
            </div>
          </header>

          <div className="header-rule"></div>

          {/* COLUMN HEADINGS */}
          <section className="cols-header">
            <div className="col-title sales">
              <div className="col-kicker">The FrameWORK</div>
              <h2>Sales Pitch Structure</h2>
              <div className="source">
                per April Dunford · <em>Sales Pitch</em> (2023)
              </div>
            </div>
            <div></div>
            <div className="col-title hero">
              <div className="col-kicker">The NARRATIVE Arc</div>
              <h2>The Hero's Journey</h2>
              <div className="source">
                per Joseph Campbell · <em>The Hero with a Thousand Faces</em> (1949)
              </div>
            </div>
          </section>

          {/* STAGE GRID */}
          <section className="stage-grid">
            {/* === PHASE 1: Setup === */}
            <div className="phase-heading-row">
              <div className="phase-side-label sales-side">The Market</div>
              <div className="rail">
                <div className="rail-line"></div>
              </div>
              <div className="phase-side-label hero-side">Setup &amp; Departure</div>
            </div>

            <div className="phase-section">
              <div className="col left">
                {SETUP_PITCH.map((s) => (
                  <Step key={s.num} side="left" tone={s.tone} {...s} />
                ))}
              </div>

              <div className="rail">
                <div className="rail-line"></div>
                <div className="phase" style={{ margin: 'auto 0' }}>
                  <div className="phase-marker setup"></div>
                  <div className="phase-label setup">The Setup</div>
                </div>
              </div>

              <div className="col right">
                {SETUP_HERO.map((s) => (
                  <Step key={s.num} side="right" tone={s.tone} {...s} />
                ))}
              </div>
            </div>

            {/* === BRIDGE === */}
            <div className="bridge">
              <div className="line"></div>
              <div className="chip">The pitch is the story · the story is the pitch</div>
              <div className="line"></div>
            </div>

            {/* === PHASE 2: Follow-Through === */}
            <div className="phase-heading-row">
              <div className="phase-side-label sales-side">Your Solution</div>
              <div className="rail">
                <div className="rail-line"></div>
              </div>
              <div className="phase-side-label hero-side">Initiation &amp; Return</div>
            </div>

            <div className="phase-section">
              <div className="col left">
                {FOLLOW_PITCH.map((s) => (
                  <Step key={s.num} side="left" tone={s.tone} {...s} />
                ))}
              </div>

              <div className="rail">
                <div className="rail-line"></div>
                <div className="phase" style={{ margin: 'auto 0' }}>
                  <div className="phase-marker follow"></div>
                  <div className="phase-label follow">The Follow-Through</div>
                </div>
              </div>

              <div className="col right">
                {FOLLOW_HERO.map((s) => (
                  <Step key={s.num} side="right" tone={s.tone} {...s} />
                ))}
              </div>
            </div>
          </section>

          {/* THESIS */}
          <aside className="thesis">
            <div className="thesis-mark">&ldquo;</div>
            <div className="thesis-body">
              A sales pitch that forgets the <em>story</em> won't inspire anyone.
              <br />
              A story that forgets the <em>sales pitch</em> never closes.
              <br />
              <strong>Make the customer the hero.</strong>
            </div>
          </aside>

          {/* FOOTER */}
          <footer className="footer">
            <div className="sources">
              <div className="sources-label">Sources</div>
              <em>Sales Pitch</em> — April Dunford, 2023
              <br />
              <em>The Hero with a Thousand Faces</em> — Joseph Campbell, 1949
            </div>
            <div className="center">
              Bryan Finfrock · Product Marketing
              <br />
              <span style={{ color: 'var(--amethyst)' }}>◆</span> FIN Consulting · v1.1 · 2026
            </div>
            <div className="right">
              LinkedIn · <span className="handle">/in/bryanfinfrock</span>
              <br />
              <span className="footer-tag">
                don't arrive with answers.
                <br />
                arrive with better questions.
              </span>
            </div>
          </footer>
        </article>
      </div>
    </div>
  )
}

/* ---------- Step card ---------- */
function Step({ side, tone, num, label, title, desc }) {
  return (
    <div className={`step ${side} ${tone}`}>
      <span className="step-num">
        {num} · {label}
      </span>
      <h3 className="step-title">{title}</h3>
      <p className="step-desc">{desc}</p>
    </div>
  )
}

/* ---------- Placeholder logo mark ---------- */
/* Swap this for an <img src="/your-logo.svg" /> from your /public folder. */
function LogoMark() {
  return (
    <svg
      width="110"
      height="110"
      viewBox="0 0 110 110"
      style={{ filter: 'drop-shadow(0 0 14px rgba(163,230,53,.45))', opacity: 0.95 }}
    >
      <circle cx="55" cy="55" r="42" fill="none" stroke="#A3E635" strokeWidth="1.5" />
      <circle cx="55" cy="55" r="30" fill="none" stroke="#8B5CF6" strokeWidth="1" opacity="0.55" />
      <text
        x="55"
        y="63"
        textAnchor="middle"
        fontFamily="'Josefin Sans', sans-serif"
        fontWeight="300"
        fontStyle="italic"
        fontSize="30"
        fill="#A3E635"
        letterSpacing="2"
      >
        FIN
      </text>
    </svg>
  )
}

/* ---------- Data ---------- */

const SETUP_PITCH = [
  { num: '01', label: 'Pitch', tone: 's1', title: 'Insight',
    desc: 'Define the current market and the risk of not changing' },
  { num: '02', label: 'Pitch', tone: 's2', title: 'Alternatives',
    desc: 'What options does the buyer have?' },
  { num: '03', label: 'Pitch', tone: 's3', title: 'Perfect World',
    desc: '"Imagine if you could…"' },
]

const SETUP_HERO = [
  { num: '01', label: 'Journey', tone: 'a1', title: 'Ordinary World',
    desc: "The hero's daily life before the adventure begins" },
  { num: '02', label: 'Journey', tone: 'a2', title: 'Call to Adventure',
    desc: 'The problem presents itself and demands a response' },
  { num: '03', label: 'Journey', tone: 'a3', title: 'Refusing the Call',
    desc: 'The hero hesitates with fear or uncertainty' },
  { num: '04', label: 'Journey', tone: 'a4', title: 'Mentor / Depart',
    desc: 'Advice for the journey ahead...' },
]

const FOLLOW_PITCH = [
  { num: '04', label: 'Pitch', tone: 's4', title: 'Introduction',
    desc: 'Introduce the prospect to the solution' },
  { num: '05', label: 'Pitch', tone: 's5', title: 'Value',
    desc: 'Establish differentiation' },
  { num: '06', label: 'Pitch', tone: 's6', title: 'Proof',
    desc: 'Validate differentiation with real examples' },
  { num: '07', label: 'Pitch', tone: 's7', title: 'Objections',
    desc: 'Overcome concerns' },
  { num: '08', label: 'Pitch', tone: 's8', title: 'Ask',
    desc: 'Demonstrate, then close' },
]

const FOLLOW_HERO = [
  { num: '05', label: 'Journey', tone: 'a5',
    title: (<>1<sup style={{ fontSize: '.55em' }}>st</sup> Threshold</>),
    desc: 'Entering the "special world"' },
  { num: '06', label: 'Journey', tone: 'a6', title: 'Tests & Enemies',
    desc: 'Meeting new friends and encountering new foes' },
  { num: '07', label: 'Journey', tone: 'a7', title: 'Approach',
    desc: 'Preparing before the major challenge' },
  { num: '08', label: 'Journey', tone: 'a8', title: 'The Ordeal',
    desc: 'Confronting the greatest fear' },
  { num: '09', label: 'Journey', tone: 'a9', title: 'Reward',
    desc: 'Achievement and transformation; the elixir' },
  { num: '10', label: 'Journey', tone: 'a10', title: 'The Road Back',
    desc: 'Journey home with new wisdom' },
  { num: '11', label: 'Journey', tone: 'a11', title: 'New Life',
    desc: 'Final test to prove the transformation is real' },
  { num: '12', label: 'Journey', tone: 'a12', title: 'Return w/ the Elixir',
    desc: 'Sharing the wisdom of the world' },
]

/* ---------- Styles ---------- */
const CSS = `
.heropitch-page{
  /* Site tokens (mirrors index.css :root) — re-declared so the component
     works even when mounted outside the global CSS scope. */
  --bg: #0D0F1A;
  --bg-raised: #161927;
  --bg-elevated: #1D2235;
  --border: #252A40;
  --border-strong: #353C58;
  --divider: #1F2336;
  --text: #DDE4F0;
  --text-muted: #8C95AE;
  --text-dim: #5C6783;

  --sapphire: #2D7DD2;
  --sapphire-deep: #1A4F8A;
  --sapphire-sky: #5FA8E8;
  --sapphire-abyss: #0A1F3D;

  --amethyst: #8B5CF6;
  --amethyst-deep: #5B3AAD;
  --amethyst-lavender: #B794FA;
  --amethyst-void: #1A0F33;

  --acid-lime: #A3E635;
  --acid-lime-forest: #3D6B00;
  --acid-lime-chartreuse: #CEFF6B;
  --acid-lime-shadow: #1A2E00;

  --slate: #97BFE5;

  background:#05060c;
  color:var(--text);
  font-family:'Lato',system-ui,sans-serif;
  min-height:100vh;
}
.heropitch-page *,
.heropitch-page *::before,
.heropitch-page *::after{box-sizing:border-box}

.heropitch-page .page-wrap{display:flex;justify-content:center;padding:40px 20px 60px}

.heropitch-page .poster{
  width:1200px;max-width:100%;
  background:
    radial-gradient(1200px 900px at 85% -10%, rgba(139,92,246,.18), transparent 60%),
    radial-gradient(1000px 700px at 10% 110%, rgba(163,230,53,.10), transparent 60%),
    radial-gradient(900px 700px at 50% 45%, rgba(45,125,210,.08), transparent 70%),
    var(--bg);
  color:var(--text);
  position:relative;overflow:hidden;
  border:1px solid #1b1f2f;
  box-shadow:0 40px 120px rgba(0,0,0,.6), 0 0 0 1px rgba(139,92,246,.08);
}
.heropitch-page .poster::before{
  content:"";position:absolute;inset:0;pointer-events:none;
  background-image:
    linear-gradient(to right, rgba(221,228,240,.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(221,228,240,.025) 1px, transparent 1px);
  background-size:48px 48px;
  -webkit-mask-image: radial-gradient(1000px 1200px at 50% 40%, black, transparent 85%);
          mask-image: radial-gradient(1000px 1200px at 50% 40%, black, transparent 85%);
}

/* HEADER */
.heropitch-page .header{padding:56px 64px 36px;position:relative;display:grid;grid-template-columns:1fr auto;gap:32px;align-items:start}
.heropitch-page .eyebrow{
  font-family:'JetBrains Mono', ui-monospace, monospace;
  font-size:12px;letter-spacing:.28em;text-transform:uppercase;
  color:var(--acid-lime);
  display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;
}
.heropitch-page .eyebrow::before{content:"";width:28px;height:1px;background:var(--acid-lime)}
.heropitch-page h1.title{
  font-family:'Josefin Sans',sans-serif;font-weight:300;font-size:88px;
  line-height:.95;margin:0;letter-spacing:-.01em;color:var(--text);
}
.heropitch-page h1.title .accent{color:var(--acid-lime);font-weight:500;font-style:italic}
.heropitch-page .subtitle{
  font-family:'Josefin Sans',sans-serif;font-weight:400;font-size:22px;
  letter-spacing:.18em;text-transform:uppercase;color:var(--amethyst-lavender);
  margin:22px 0 0 0;max-width:720px;line-height:1.3;
}
.heropitch-page .subtitle .divider{
  display:inline-block;width:8px;height:8px;background:var(--amethyst);
  margin:0 14px 3px;transform:rotate(45deg);
}
.heropitch-page .logo-box{display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.heropitch-page .logo-box .tagline{
  font-family:'JetBrains Mono', monospace;font-size:10px;letter-spacing:.3em;
  text-transform:uppercase;color:var(--text-muted);text-align:right;
}
.heropitch-page .header-rule{
  margin:36px 64px 0;height:1px;
  background:linear-gradient(to right, transparent, var(--border-strong) 15%, var(--border-strong) 85%, transparent);
}

/* COLUMN HEADINGS */
.heropitch-page .cols-header{display:grid;grid-template-columns:1fr 140px 1fr;padding:36px 64px 0}
.heropitch-page .col-title{text-align:center}
.heropitch-page .col-kicker{
  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.3em;
  text-transform:uppercase;color:var(--text-muted);margin-bottom:10px;
}
.heropitch-page .col-title h2{
  font-family:'Josefin Sans',sans-serif;font-weight:600;font-size:34px;margin:0;
  letter-spacing:.04em;text-transform:uppercase;
}
.heropitch-page .col-title.sales h2{color:var(--sapphire-sky)}
.heropitch-page .col-title.hero h2{color:var(--acid-lime)}
.heropitch-page .col-title .source{
  font-family:'Lato',sans-serif;font-style:italic;font-weight:300;
  color:var(--text-muted);font-size:13px;margin-top:8px;letter-spacing:.02em;
}

/* STAGE GRID */
.heropitch-page .stage-grid{padding:24px 64px 40px;position:relative}
.heropitch-page .phase-section{
  display:grid;grid-template-columns:1fr 140px 1fr;align-items:stretch;
}
.heropitch-page .phase-heading-row{
  display:grid;grid-template-columns:1fr 140px 1fr;margin-bottom:8px;
}
.heropitch-page .phase-side-label{
  font-family:'Josefin Sans',sans-serif;font-weight:500;font-size:15px;
  letter-spacing:.28em;text-transform:uppercase;padding:14px 22px 6px;
}
.heropitch-page .phase-side-label.sales-side{color:var(--sapphire-sky);text-align:right}
.heropitch-page .phase-side-label.hero-side{color:var(--acid-lime);text-align:left}

/* center rail */
.heropitch-page .rail{position:relative;display:flex;flex-direction:column;align-items:center}
.heropitch-page .rail-line{
  position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);
  width:1px;
  background:linear-gradient(to bottom, transparent, var(--border-strong) 4%, var(--border-strong) 96%, transparent);
}
.heropitch-page .phase{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px 0}
.heropitch-page .phase-label{
  writing-mode:vertical-rl;transform:rotate(180deg);
  font-family:'Josefin Sans',sans-serif;font-weight:500;
  text-transform:uppercase;letter-spacing:.32em;font-size:16px;padding:28px 0;
  color:var(--amethyst);position:relative;
}
.heropitch-page .phase-label.setup{color:var(--sapphire-sky)}
.heropitch-page .phase-label.follow{color:var(--acid-lime)}
.heropitch-page .phase-marker{
  width:14px;height:14px;border:1.5px solid var(--amethyst);
  background:var(--bg);transform:rotate(45deg);position:relative;
}
.heropitch-page .phase-marker.setup{border-color:var(--sapphire-sky);color:var(--sapphire-sky)}
.heropitch-page .phase-marker.follow{border-color:var(--acid-lime);color:var(--acid-lime)}
.heropitch-page .phase-marker::after{
  content:"";position:absolute;inset:3px;background:currentColor;opacity:.5;
}

/* step columns */
.heropitch-page .col{display:flex;flex-direction:column;gap:14px;flex:1 1 0}
.heropitch-page .col.left{align-items:flex-end}
.heropitch-page .col.right{align-items:flex-start}

.heropitch-page .step{
  width:100%;max-width:420px;
  background:rgba(13,15,26,.5);
  border:1px solid rgba(75,101,132,.35);
  padding:18px 22px;position:relative;
  backdrop-filter:blur(2px);
  transition:all .2s ease;
  flex:1 1 0;display:flex;flex-direction:column;justify-content:center;
}
.heropitch-page .step.left{border-right:3px solid var(--hp-accent);text-align:right;padding-right:20px}
.heropitch-page .step.right{border-left:3px solid var(--hp-accent);text-align:left;padding-left:20px}
.heropitch-page .step-num{
  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;
  color:var(--text-muted);margin-bottom:4px;display:block;
}
.heropitch-page .step-title{
  font-family:'Josefin Sans',sans-serif;font-weight:600;font-size:22px;
  letter-spacing:.08em;text-transform:uppercase;color:var(--text);
  margin:0 0 6px 0;line-height:1;
}
.heropitch-page .step-desc{
  font-family:'Lato',sans-serif;font-weight:400;font-size:14.5px;line-height:1.5;
  color:var(--text-muted);margin:0;
}

/* sapphire scale (left) */
.heropitch-page .step.s1{--hp-accent:var(--slate)}
.heropitch-page .step.s2{--hp-accent:var(--sapphire-sky)}
.heropitch-page .step.s3{--hp-accent:var(--sapphire)}
.heropitch-page .step.s4{--hp-accent:var(--sapphire-sky)}
.heropitch-page .step.s5{--hp-accent:var(--sapphire)}
.heropitch-page .step.s6{--hp-accent:var(--sapphire-deep)}
.heropitch-page .step.s7{--hp-accent:var(--sapphire-deep)}
.heropitch-page .step.s8{--hp-accent:var(--sapphire-abyss);border-right-color:var(--sapphire)}

/* amber scale (right) */
.heropitch-page .step.a1{--hp-accent:var(--acid-lime-chartreuse)}
.heropitch-page .step.a2{--hp-accent:var(--acid-lime)}
.heropitch-page .step.a3{--hp-accent:var(--acid-lime)}
.heropitch-page .step.a4{--hp-accent:var(--acid-lime)}
.heropitch-page .step.a5{--hp-accent:var(--acid-lime)}
.heropitch-page .step.a6{--hp-accent:var(--acid-lime)}
.heropitch-page .step.a7{--hp-accent:var(--acid-lime-forest)}
.heropitch-page .step.a8{--hp-accent:var(--acid-lime-forest)}
.heropitch-page .step.a9{--hp-accent:var(--acid-lime-forest)}
.heropitch-page .step.a10{--hp-accent:var(--acid-lime-forest)}
.heropitch-page .step.a11{--hp-accent:var(--acid-lime-shadow);border-left-color:var(--acid-lime-forest)}
.heropitch-page .step.a12{--hp-accent:var(--acid-lime-shadow);border-left-color:var(--acid-lime-forest)}

/* BRIDGE */
.heropitch-page .bridge{
  display:grid;grid-template-columns:1fr auto 1fr;align-items:center;
  gap:24px;margin:28px 0;
}
.heropitch-page .bridge .line{height:1px;background:linear-gradient(to right, transparent, var(--amethyst), transparent)}
.heropitch-page .bridge .chip{
  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.3em;
  text-transform:uppercase;color:var(--amethyst);padding:8px 16px;
  border:1px solid var(--amethyst);background:rgba(139,92,246,.06);
}

/* THESIS */
.heropitch-page .thesis{
  margin:8px 64px 0;padding:36px 40px;
  border-top:1px solid var(--border-strong);border-bottom:1px solid var(--border-strong);
  display:grid;grid-template-columns:auto 1fr;gap:40px;align-items:center;
}
.heropitch-page .thesis-mark{
  font-family:'Josefin Sans',sans-serif;font-weight:300;font-size:120px;
  line-height:.7;color:var(--amethyst);font-style:italic;opacity:.9;
}
.heropitch-page .thesis-body{
  font-family:'Lato',sans-serif;font-weight:300;font-size:22px;line-height:1.45;
  color:var(--text);max-width:820px;text-align:center;
}
.heropitch-page .thesis-body strong{color:var(--acid-lime);font-weight:700}
.heropitch-page .thesis-body em{color:var(--amethyst-lavender);font-style:italic;font-weight:400}

/* FOOTER */
.heropitch-page .footer{
  padding:28px 64px 40px;
  display:grid;grid-template-columns:1fr auto 1fr;gap:24px;align-items:end;
  font-family:'Lato',sans-serif;font-size:12px;color:var(--text-muted);
}
.heropitch-page .footer .sources em{color:var(--amethyst-lavender);font-style:italic;font-weight:400}
.heropitch-page .footer .sources-label{
  color:var(--amethyst-lavender);font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;font-size:11px;margin-bottom:6px;
}
.heropitch-page .footer .center{
  text-align:center;font-family:'JetBrains Mono',monospace;
  font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--border-strong);
}
.heropitch-page .footer .right{
  text-align:right;font-family:'JetBrains Mono',monospace;
  font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--text-muted);
}
.heropitch-page .footer .right .handle{color:var(--acid-lime)}
.heropitch-page .footer .right .footer-tag{color:var(--border-strong)}

/* corner brackets */
.heropitch-page .corner{position:absolute;width:36px;height:36px;border-color:var(--amethyst);opacity:.7}
.heropitch-page .corner.tl{top:20px;left:20px;border-top:1px solid;border-left:1px solid}
.heropitch-page .corner.tr{top:20px;right:20px;border-top:1px solid;border-right:1px solid}
.heropitch-page .corner.bl{bottom:20px;left:20px;border-bottom:1px solid;border-left:1px solid}
.heropitch-page .corner.br{bottom:20px;right:20px;border-bottom:1px solid;border-right:1px solid}
`
