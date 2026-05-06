import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

export default function AppGateway() {
  const navigate = useNavigate()
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleAuth(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false) }
      else navigate('/dashboard')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false) }
      else { setError('Check your email to confirm your account.'); setLoading(false) }
    }
  }

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
              <em style={{ fontStyle: 'normal', color: 'var(--text-dim)', fontWeight: 300, marginLeft: '0.55rem' }}>
                
              </em>
            </span>
          </div>
          <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            {[
              { label: 'Home',  path: '/' },
              { label: 'About', path: '/about' },
              { label: 'Art',   path: '/art' },
              { label: 'App',   path: '/app', active: true },
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
          <div className="eyebrow" style={{ marginBottom: '1rem', color: 'var(--amber)' }}>04 / APP</div>
          <h1 style={{
            fontFamily: 'Josefin Sans', fontWeight: 300,
            fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
            letterSpacing: '0.02em', lineHeight: 1.1,
            margin: '0 0 1rem',
          }}>
            Combining expertise with functionality.
          </h1>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'JetBrains Mono', fontSize: '0.78rem',
              color: 'var(--sapphire-sky)', letterSpacing: '0.04em',
            }}>Platform · v0.6 — phase 4</span>
            <span style={{ width: 1, height: 14, background: 'rgba(75,101,132,0.4)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Live build</span>
          </div>
          <p style={{
            maxWidth: '60ch', fontSize: '1rem', lineHeight: 1.75,
            color: 'var(--text-dim)', marginTop: '1.5rem',
          }}>
            Most portfolios (like the ART page) share samples of past work. This one runs it. BattleBot began as a curiosity. Can I transform best practices for a standard process into an AI-powered workflow? With each little bug that I removed from the initial build, I had another new idea to improve it. This serves as a great example of how my creativity and passion for marketing come to life. If you’re looking to add a full-time Product Marketing Manager to your team, I’d love to give you a demo.  
          </p>
        </div>

        {/* App cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '4rem' }}>

          {/* BattleBot card */}
          <div style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            padding: '2rem', position: 'relative', overflow: 'hidden',
          }}>
            {/* Active indicator */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: 'linear-gradient(90deg, var(--sapphire), var(--amethyst))',
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: '0.5rem' }}>
                  AI APP / 001 · Competitive Intelligence
                </div>
                <h2 style={{
                  fontFamily: 'Josefin Sans', fontWeight: 300,
                  fontSize: '1.75rem', letterSpacing: '0.04em',
                  margin: 0, textTransform: 'uppercase',
                }}>BattleBot</h2>
              </div>
              <div style={{
                width: 8, height: 8, background: 'var(--status-complete)',
                borderRadius: '50%', marginTop: 6,
                boxShadow: '0 0 0 3px rgba(74,222,128,0.2)',
              }} />
            </div>

            <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
              Team up with Claude to reduce production time and expand knowledge. The Battlebot application is a Human-in-the-Loop tool to conduct research and prepare an insightful, relevant Battlecard to help revenue teams close deals faster.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {['ICP', 'Customer Reviews', 'Analyst Evaluations', 'Fear, Uncertainty, Doubt'].map(tag => (
                <span key={tag} style={{
                  fontFamily: 'JetBrains Mono', fontSize: '0.7rem',
                  padding: '0.25rem 0.6rem',
                  border: '1px solid rgba(75,101,132,0.35)',
                  color: 'var(--text-dim)',
                }}>{tag}</span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {['Tab 01 · Use Cases', 'Tab 02 · Critical Intel', 'Tab 03 · FUD & Proof'].map(tab => (
                <span key={tab} style={{
                  fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                  letterSpacing: '0.14em', fontSize: '0.7rem',
                  color: 'var(--text-dim)',
                }}>{tab}</span>
              ))}
            </div>

            <button
              onClick={() => { setShowAuth(true); setAuthMode('login') }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.7rem',
                fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                letterSpacing: '0.22em', fontSize: '0.78rem', fontWeight: 500,
                padding: '0.95rem 1.6rem',
                border: '1px solid var(--amber)', color: 'var(--amber)',
                background: 'transparent', cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--amber)'; e.currentTarget.style.color = 'var(--bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--amber)' }}
            >
              Launch →
            </button>
          </div>

          {/* Coming soon card */}
          <div style={{
            background: 'transparent',
            border: '1px dashed rgba(75,101,132,0.35)',
            padding: '2rem',
          }}>
            <div className="eyebrow" style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
              NEXT / 002
            </div>
            <h2 style={{
              fontFamily: 'Josefin Sans', fontWeight: 300,
              fontSize: '1.75rem', letterSpacing: '0.04em',
              margin: '0 0 1.25rem', textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}>More agents in build.</h2>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
              The BattleBot was just step one. Items on the roadmap include:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {['Product Positioning Workflow', 'Differentiation Validator', 'Analyst Report Summarizer', 'Win/Loss Reality Check'].map(item => (
                <div key={item} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ width: 4, height: 4, background: 'rgba(75,101,132,0.5)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stack */}
        <div style={{
          borderTop: '1px solid rgba(75,101,132,0.25)',
          paddingTop: '2.5rem',
        }}>
          <div className="eyebrow" style={{ marginBottom: '1.25rem' }}>Stack</div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {['React 18', 'Vite', 'Tailwind v3', 'Netlify + Functions', 'Supabase Auth + Postgres', 'Anthropic claude-sonnet-4-6'].map(item => (
              <span key={item} style={{
                fontFamily: 'JetBrains Mono', fontSize: '0.78rem',
                color: 'var(--text-dim)', letterSpacing: '0.04em',
              }}>{item}</span>
            ))}
          </div>
        </div>

      </main>

      {/* Auth modal */}
      {showAuth && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(10,12,22,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowAuth(false) }}
        >
          <div style={{
            width: 420, background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            padding: '40px 36px', position: 'relative',
          }}>
            {/* Corner ticks */}
            {['tl','tr','bl','br'].map(p => (
              <div key={p} style={{
                position: 'absolute', width: 10, height: 10,
                borderColor: 'var(--amber)', borderStyle: 'solid', borderWidth: 0,
                ...(p.includes('t') ? { top: -1, borderTopWidth: 1 } : { bottom: -1, borderBottomWidth: 1 }),
                ...(p.includes('l') ? { left: -1, borderLeftWidth: 1 } : { right: -1, borderRightWidth: 1 }),
              }} />
            ))}

            <button onClick={() => setShowAuth(false)} style={{
              position: 'absolute', top: 14, right: 16,
              background: 'none', border: 'none', color: 'var(--text-dim)',
              fontSize: 18, cursor: 'pointer', lineHeight: 1,
            }}>✕</button>

            <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 10 }}>
              BattleBot · {authMode === 'login' ? 'Sign in' : 'Create account'}
            </div>
            <h2 className="h-display" style={{ fontSize: 28, margin: '0 0 8px', fontWeight: 300 }}>
              {authMode === 'login' ? 'Welcome back,' : 'Get started,'}
              <br /><span style={{ color: 'var(--amber)' }}>operator.</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, lineHeight: 1.55 }}>
              Authentication is handled by Supabase. Your session is scoped to this platform only.
            </p>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="bb-label">Email</label>
                <input className="bb-input" type="email" placeholder="you@company.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="bb-label">Password</label>
                <input className="bb-input" type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required />
              </div>

              {error && (
                <div style={{
                  fontSize: 13, padding: '10px 14px',
                  color: error.includes('Check your email') ? 'var(--status-complete)' : 'var(--status-error)',
                  border: `1px solid ${error.includes('Check your email') ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  background: error.includes('Check your email') ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
                }}>{error}</div>
              )}

              <button className="bb-btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', padding: 14, marginTop: 4, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Please wait…' : authMode === 'login' ? 'Sign in & launch →' : 'Create account →'}
              </button>
            </form>

            
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(75,101,132,0.18)',
        padding: '2.5rem 0',
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
              { label: 'Email',     href: 'mailto:bryan.finfrock@gmail.com' },
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