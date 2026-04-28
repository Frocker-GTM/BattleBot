import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()

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
            <div style={{
              width: 8, height: 8, background: 'var(--amber)',
              transform: 'rotate(45deg)',
            }} />
            <span style={{
              fontFamily: 'Josefin Sans', textTransform: 'uppercase',
              letterSpacing: '0.22em', fontSize: '0.82rem', fontWeight: 500,
            }}>
              Bryan Finfrock
              <em style={{
                fontStyle: 'normal', color: 'var(--text-dim)',
                fontWeight: 300, marginLeft: '0.55rem',
              }}>FIN Consulting</em>
            </span>
          </div>
          <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            {[
              { label: 'Home', path: '/', active: true },
              { label: 'About', path: '/about' },
              { label: 'App', path: '/app' },
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

      {/* Hero */}
      <main style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1240, margin: '0 auto',
        padding: '0 clamp(1.5rem, 4vw, 3.5rem)',
        paddingTop: 'clamp(4rem, 8vw, 7rem)',
        paddingBottom: 'clamp(4rem, 8vw, 7rem)',
      }}>
        <div style={{ maxWidth: 780 }}>
          <div className="eyebrow" style={{ marginBottom: '1.5rem' }}>
            Product Marketing · B2B SaaS
          </div>

          <h1 style={{
            fontFamily: 'Josefin Sans', fontWeight: 200,
            fontSize: 'clamp(3rem, 7vw, 6.5rem)',
            letterSpacing: '-0.01em', lineHeight: 0.95,
            margin: '0 0 1.5rem',
          }}>
            Bryan<br />Finfrock.
          </h1>

          <p style={{
            fontFamily: 'Josefin Sans', fontWeight: 300,
            fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            color: 'var(--text-dim)', letterSpacing: '0.02em',
            margin: '0 0 0.75rem',
          }}>
            GTM strategist.
            <span style={{ color: 'var(--amber)', marginLeft: '0.5rem' }}>
              Asks better questions.
            </span>
          </p>

          <blockquote style={{
            borderLeft: '2px solid var(--amber)',
            paddingLeft: '1.25rem', margin: '2rem 0 2.5rem',
            fontStyle: 'italic', color: 'var(--text-dim)', fontSize: '0.95rem',
          }}>
            "I don't arrive with all the answers. I arrive with better questions."
          </blockquote>

          <p style={{
            fontSize: '1rem', lineHeight: 1.7,
            color: 'var(--text-dim)', maxWidth: '64ch',
            margin: '0 0 2.5rem',
          }}>
            15+ years building product marketing and GTM motions for enterprise
            B2B SaaS and Martech — Oracle, Marigold, Beanworks. Currently open
            to Director and Senior PMM roles in Martech, AI, and enterprise SaaS.
            Remote.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="/about" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.7rem',
              fontFamily: 'Josefin Sans', textTransform: 'uppercase',
              letterSpacing: '0.22em', fontSize: '0.78rem', fontWeight: 500,
              padding: '0.95rem 1.6rem',
              border: '1px solid var(--sapphire)', color: 'var(--text)',
              textDecoration: 'none',
              transition: 'all 200ms ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--sapphire)'; e.currentTarget.style.color = 'var(--bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text)' }}
            >
              Learn more →
            </a>
            <a href="/app" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.7rem',
              fontFamily: 'Josefin Sans', textTransform: 'uppercase',
              letterSpacing: '0.22em', fontSize: '0.78rem', fontWeight: 500,
              padding: '0.95rem 1.6rem',
              border: '1px solid var(--amber)', color: 'var(--amber)',
              textDecoration: 'none',
              transition: 'all 200ms ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--amber)'; e.currentTarget.style.color = 'var(--bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--amber)' }}
            >
              See the work →
            </a>
          </div>
        </div>

        {/* Proof card */}
        <div style={{
          marginTop: 'clamp(4rem, 8vw, 6rem)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '2rem',
          borderTop: '1px solid rgba(75,101,132,0.25)',
          paddingTop: '3rem',
        }}>
          {[
            { value: '8×',   label: 'Analyst inquiry growth' },
            { value: '4×',   label: 'Briefing growth' },
            { value: '#1',   label: "Google ranking, 'campaign management'" },
            { value: '15+',  label: 'Years in B2B SaaS' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div style={{
                fontFamily: 'Josefin Sans', fontWeight: 200,
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                color: 'var(--amber)', letterSpacing: '-0.01em',
                lineHeight: 1,
              }}>{value}</div>
              <div style={{
                marginTop: '0.5rem', fontSize: '0.85rem',
                color: 'var(--text-dim)', lineHeight: 1.4,
              }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Operating ground */}
        <div style={{
          marginTop: 'clamp(4rem, 6vw, 5rem)',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '3rem',
          borderTop: '1px solid rgba(75,101,132,0.25)',
          paddingTop: '3rem',
        }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '1.25rem' }}>Operating ground</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {['Martech', 'AI & ML GTM', 'Analyst Relations', 'Sales Enablement', 'Positioning'].map(tag => (
                <span key={tag} style={{
                  fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                  letterSpacing: '0.16em', fontSize: '0.72rem',
                  padding: '0.4rem 0.85rem',
                  border: '1px solid rgba(75,101,132,0.35)',
                  color: 'var(--text-dim)',
                }}>{tag}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {[
              { label: 'Currently',  value: 'Open to Director and Senior PMM roles. Remote.' },
              { label: 'Focus',      value: 'Martech, AI, enterprise SaaS GTM' },
              { label: 'Building',   value: 'BattleBot — competitive battlecard agent' },
              { label: 'Background', value: 'USAF veteran · Weather Forecaster' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="eyebrow" style={{ marginBottom: '0.4rem' }}>{label}</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{value}</div>
              </div>
            ))}
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
            FIN CONSULTING / / BRYAN FINFROCK / / © 2026
          </div>
          <div style={{ display: 'flex', gap: '1.6rem' }}>
            {[
              { label: 'LinkedIn', href: 'https://linkedin.com/in/bryanfinfrock' },
              { label: 'Email',    href: 'mailto:hello@finfrock.co' },
              { label: 'BattleBot', href: '/app' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{
                fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                letterSpacing: '0.22em', fontSize: '0.74rem',
                color: 'var(--text-dim)', textDecoration: 'none',
                transition: 'color 160ms ease',
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