export default function About() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', right: '-5%', top: '-10%',
          width: 1200, height: 600, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(45,125,210,0.10) 0%, transparent 60%)',
          filter: 'blur(20px)',
        }} />
        <div style={{
          position: 'absolute', left: '-10%', bottom: '0%',
          width: 900, height: 500, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 60%)',
          filter: 'blur(20px)',
        }} />
      </div>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(14px)',
        background: 'rgba(13,15,26,0.72)',
        borderBottom: '1px solid rgba(75,101,132,0.18)',
      }}>
        <div style={{
          maxWidth: 1240, margin: '0 auto',
          padding: '0 clamp(1.5rem, 4vw, 3.5rem)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: 76,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 8, height: 8, background: 'var(--amber)', transform: 'rotate(45deg)' }} />
            <span style={{
              fontFamily: 'Josefin Sans', textTransform: 'uppercase',
              letterSpacing: '0.22em', fontSize: '0.82rem', fontWeight: 500,
            }}>
              Bryan Finfrock
            </span>
          </div>
          <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            {[
              { label: 'Home',  path: '/' },
              { label: 'About', path: '/about', active: true },
              { label: 'Art',   path: '/art' },
              { label: 'App',   path: '/app' },
            ].map(({ label, path, active }) => (
              <a key={label} href={path} style={{
                fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                letterSpacing: '0.22em', fontSize: '0.78rem', fontWeight: 400,
                color: active ? 'var(--text)' : 'var(--text-dim)',
                textDecoration: 'none', padding: '0.4rem 0',
                borderBottom: active ? '1px solid var(--amber)' : '1px solid transparent',
              }}>{label}</a>
            ))}
          </nav>
        </div>
      </header>

      <main style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1240, margin: '0 auto',
        padding: '0 clamp(1.5rem, 4vw, 3.5rem)',
        paddingTop: 'clamp(4rem, 8vw, 7rem)',
        paddingBottom: 'clamp(4rem, 8vw, 7rem)',
      }}>

        {/* Page header */}
        <div style={{ marginBottom: '4rem' }}>
          <div className="eyebrow" style={{ marginBottom: '1rem', color: 'var(--amber)' }}>02 / ABOUT</div>
          <h1 style={{
            fontFamily: 'Josefin Sans', fontWeight: 300,
            fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
            letterSpacing: '0.02em', lineHeight: 1.1,
            margin: '0 0 0.75rem',
          }}>
            The work, the operator,<br />and the philosophy.
          </h1>
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, var(--amber), transparent)',
            width: 120, marginTop: '1.5rem',
          }} />
        </div>

        {/* Summary */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 2fr',
          gap: '4rem', marginBottom: '5rem',
          borderBottom: '1px solid rgba(75,101,132,0.25)',
          paddingBottom: '4rem',
        }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>Summary</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              A condensed read.
            </div>
            <blockquote style={{
              borderLeft: '2px solid var(--amethyst)',
              paddingLeft: '1rem', marginTop: '1.5rem',
              fontStyle: 'italic', color: 'var(--text-dim)', fontSize: '0.85rem',
              lineHeight: 1.6,
            }}>
              "Performs curiosity, not confidence."
            </blockquote>
          </div>
          <div>
            <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--text-dim)', marginBottom: '1.1rem' }}>
              I transform confusing technology into compelling narratives. After 15+ years of contributing
              to product marketing for enterprise B2B SaaS and Martech platforms, I've learned that the
              best GTM strategies aren't built in isolation. They are built by asking the right questions,
              listening across functions, and bringing people together around shared goals and solutions.
            </p>
            <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--text-dim)', marginBottom: '1.1rem' }}>
              At Oracle, I partnered with product leadership to build the GTM foundation for the Responsys
              Advanced Intelligence suite — a portfolio of ML-powered features that simplified how enterprise
              marketers personalize customer experiences at scale. At Marigold, I collaborated across product
              and deliverability to develop Projected Open Rate in response to Apple's Mail Privacy Protection.
              Our solution became an industry standard when Braze and others followed.
            </p>
            <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--text-dim)' }}>
              I thrive when the problem requires strategic thinking and cross-functional trust. I've managed
              Forrester and Gartner relationships, unified siloed PMM teams across multiple brands, and
              enabled revenue teams with the tools and stories they need to win.
            </p>
          </div>
        </div>

        {/* Career highlights */}
        <div style={{ marginBottom: '5rem', borderBottom: '1px solid rgba(75,101,132,0.25)', paddingBottom: '4rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '4rem' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>Career highlights</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Things that left a fingerprint.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {[
                {
                  date: '2022 — MARIGOLD',
                  title: 'Projected Open Rate',
                  sub: 'Apple MPP mitigation',
                  body: "Co-developed the industry's response to Apple Mail Privacy Protection. Engineered with product and deliverability; positioned with sales and analysts. Braze followed months later. The fix outlived the post.",
                },
                {
                  date: '2018–21 — ORACLE',
                  title: 'Responsys Advanced Intelligence',
                  sub: 'Sole PMM architect',
                  body: "Built the GTM foundation for Oracle Responsys's ML-powered personalization suite. The authority page I wrote for 'campaign management' still ranks #1 on Google — I wrote it by asking what marketers were trying to learn, not what the product did.",
                },
                {
                  date: '2021–23 — MARIGOLD',
                  title: 'Analyst Relations',
                  sub: 'Forrester · Gartner',
                  body: 'Built the analyst program from the ground up. 8× inquiry growth, 4× briefing growth. Unified siloed PMM teams across multiple brands and turned analyst conversations into product feedback loops.',
                },
                {
                  date: 'United States Air Force',
                  title: 'Weather Forecaster',
                  sub: 'United States Air Force',
                  body: 'Learned to make confident decisions from incomplete data, and to never confuse a forecast with a guarantee. Operating philosophy: intrinsic execution over extrinsic hope.',
                },
              ].map(({ date, title, sub, body }) => (
                <div key={title} style={{
                  paddingLeft: '1.5rem',
                  borderLeft: '1px solid rgba(75,101,132,0.35)',
                }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
                    color: 'var(--text-dim)', marginBottom: '0.5rem',
                    letterSpacing: '0.04em',
                  }}>{date}</div>
                  <div style={{
                    fontFamily: 'Josefin Sans', fontSize: '1.1rem',
                    fontWeight: 500, letterSpacing: '0.02em', marginBottom: '0.2rem',
                  }}>{title}</div>
                  <div style={{
                    fontFamily: 'Josefin Sans', fontSize: '0.78rem',
                    textTransform: 'uppercase', letterSpacing: '0.18em',
                    color: 'var(--sapphire)', marginBottom: '0.75rem',
                  }}>{sub}</div>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: 'var(--text-dim)' }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Core expertise */}
        <div style={{ marginBottom: '5rem', borderBottom: '1px solid rgba(75,101,132,0.25)', paddingBottom: '4rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '4rem' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>Core expertise</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Where I tend to be useful.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {[
                {
                  n: '01', title: 'Positioning & messaging',
                  body: 'Understand the value by asking customers about problems and offering a solution.',
                },
                {
                  n: '02', title: 'AI & ML GTM',
                  body: 'Translating tool utilization into a scalable operating framework to serve the entire organization.',
                },
                {
                  n: '03', title: 'Analyst relations',
                  body: 'Forrester Wave and Gartner Magic Quadrant programs. Inquiry-to-briefing conversion. Analyst feedback as product input.',
                },
                {
                  n: '04', title: 'Sales enablement',
                  body: 'Battlecards, pitch decks, objection handling, win/loss intel. Tools that close deals — not artifacts that decorate Drive folders.',
                },
                {
                  n: '05', title: 'Cross-functional leadership',
                  body: 'Unifying siloed PMM teams across brands. Product, sales, deliverability, support — in the room together, on the same problem.',
                },
                {
                  n: '06', title: 'Competitive intelligence',
                  body: 'FUD gap analysis, source weighting, field-note loops. Keeping battlecards alive instead of letting them rot in version 1.',
                },
              ].map(({ n, title, body }) => (
                <div key={n} style={{
                  padding: '1.25rem', background: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono', fontSize: '0.7rem',
                    color: 'var(--text-dim)', marginBottom: '0.5rem',
                  }}>{n}</div>
                  <div style={{
                    fontFamily: 'Josefin Sans', fontSize: '0.95rem',
                    fontWeight: 500, letterSpacing: '0.04em', marginBottom: '0.6rem',
                    textTransform: 'uppercase',
                  }}>{title}</div>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.65, color: 'var(--text-dim)', margin: 0 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Philosophy */}
        <div style={{ marginBottom: '5rem', borderBottom: '1px solid rgba(75,101,132,0.25)', paddingBottom: '4rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '4rem' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>Philosophy</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                How the work gets done.
              </div>
              <div style={{
                marginTop: '1.5rem', fontFamily: 'Josefin Sans',
                fontWeight: 300, fontSize: '1.1rem', color: 'var(--amber)',
                letterSpacing: '0.04em', lineHeight: 1.3,
              }}>
                Better questions produce better answers.
              </div>
            </div>
            <div>
              <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--text-dim)', marginBottom: '1.1rem' }}>
                I learned to forecast weather in the United States Air Force. The job teaches you a discipline
                that travels: make a confident decision from incomplete data, then update it the moment new data
                arrives. A forecast is not a guarantee. A position is not a promise. Both are commitments to
                keep looking.
              </p>
              <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
                Most GTM problems are solved by asking the right question at the right time. The wrong question
                produces a confident, useless answer. The right question rewrites the brief. So I start every
                engagement at the customer's question, not the company's answer. The work that follows tends
                to be quieter, more accurate, and harder to copy.
              </p>
              <blockquote style={{
                borderLeft: '2px solid var(--amber)', paddingLeft: '1.25rem',
                fontStyle: 'italic', color: 'var(--text)', fontSize: '1rem',
              }}>
                "Better planning, Better results."
              </blockquote>
            </div>
          </div>
        </div>

{/* Hobbies */}
        <div style={{ marginBottom: '5rem', borderBottom: '1px solid rgba(75,101,132,0.25)', paddingBottom: '4rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '4rem' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>Interests & Hobbies</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                What I do to unwind.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {[
                {
                  n: '01', title: 'Family',
                  body: 'My wife and I enjoy any time we spend with our two daughters.',
                },
                {
                  n: '02', title: 'Live Events',
                  body: 'We love concerts and live entertainment. Our daughters have joined us for everything from Andrew Bird to The Violent Femmes',
                },
                {
                  n: '03', title: 'Chickens',
                  body: 'Our backyard coop has more than a dozen hens and a rooster named Randall.',
                },
                {
                  n: '04', title: 'Gardening',
                  body: 'Fruits, veggies, bushes, trees, and vines. Garlic is my favorite to grow, but taters always occupy most of my time.',
                },
                {
                  n: '05', title: 'Reading',
                  body: 'I like to mix a wide variety of fiction in with the assortment of professional literature.',
                },
                {
                  n: '06', title: 'Technology',
                  body: 'Whether it is Nintendo Switch time with my daughters or coding time with Claude, I love exploring and utilizing technology.',
                },
              ].map(({ n, title, body }) => (
                <div key={n} style={{
                  padding: '1.25rem', background: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono', fontSize: '0.7rem',
                    color: 'var(--text-dim)', marginBottom: '0.5rem',
                  }}>{n}</div>
                  <div style={{
                    fontFamily: 'Josefin Sans', fontSize: '0.95rem',
                    fontWeight: 500, letterSpacing: '0.04em', marginBottom: '0.6rem',
                    textTransform: 'uppercase',
                  }}>{title}</div>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.65, color: 'var(--text-dim)', margin: 0 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>


        {/* Contact */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '4rem' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>Get in touch</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                If your team needs better questions, I'm listening.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                { n: '01', label: 'LinkedIn',     value: 'linkedin.com/in/bryanfinfrock', href: 'https://linkedin.com/in/bryanfinfrock' },
                { n: '02', label: 'Email',         value: 'bryan.finfrock@gmail.com',      href: 'mailto:bryan.finfrock@gmail.com' },
                { n: '03', label: 'See the work',  value: 'BattleBot platform',             href: '/app' },
              ].map(({ n, label, value, href }) => (
                <a key={n} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: '1.5rem',
                  padding: '1.1rem 1.25rem',
                  border: '1px solid rgba(75,101,132,0.25)',
                  textDecoration: 'none', color: 'var(--text)',
                  transition: 'border-color 160ms ease',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--amber)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(75,101,132,0.25)'}
                >
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    {n}
                  </span>
                  <span style={{
                    fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                    letterSpacing: '0.18em', fontSize: '0.78rem', fontWeight: 500,
                    color: 'var(--text-dim)', minWidth: 80,
                  }}>{label}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--sapphire-sky)' }}>{value} →</span>
                </a>
              ))}
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(75,101,132,0.18)',
        padding: '2.5rem 0', marginTop: '4rem',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          maxWidth: 1240, margin: '0 auto',
          padding: '0 clamp(1.5rem, 4vw, 3.5rem)',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem',
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
            color: 'var(--text-dim)', letterSpacing: '0.04em',
          }}>
            BRYAN FINFROCK / / © 2026
          </div>
          <div style={{ display: 'flex', gap: '1.6rem' }}>
            {[
              { label: 'LinkedIn',  href: 'https://linkedin.com/in/bryanfinfrock' },
              { label: 'Email',     href: 'mailto:hello@finfrock.co' },
              { label: 'BattleBot', href: '/app' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{
                fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                letterSpacing: '0.22em', fontSize: '0.74rem',
                color: 'var(--text-dim)', textDecoration: 'none',
              }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--amber)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >{label}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
