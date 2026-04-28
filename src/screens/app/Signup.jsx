import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div style={{
      position: 'relative', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40, background: 'var(--bg)',
    }}>

      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', left: '50%', top: '60%',
          transform: 'translate(-50%,-50%)',
          width: 1100, height: 1100, borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(139,92,246,0.18) 0%, rgba(45,125,210,0.06) 40%, transparent 65%)',
          filter: 'blur(20px)',
        }} />
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#252A40" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Card */}
      <div style={{
        position: 'relative', width: 440,
        background: 'rgba(22,25,39,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        padding: '48px 44px',
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

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div className="eyebrow" style={{ color: 'var(--status-complete)', marginBottom: 14 }}>— Account created</div>
            <h1 className="h-display" style={{ fontSize: 32, margin: '0 0 18px', fontWeight: 300 }}>
              Check your<br/><span style={{ color: 'var(--amber)' }}>email.</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.55 }}>
              We sent a confirmation link to <span style={{ color: 'var(--text)' }}>{email}</span>. Click it to activate your account, then sign in.
            </p>
            <Link to="/login" style={{
              display: 'inline-block', marginTop: 28,
              color: 'var(--sapphire-sky)', fontFamily: 'Josefin Sans',
              fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 11,
            }}>
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 36 }}>
              <div className="eyebrow" style={{ marginBottom: 14, color: 'var(--amber)' }}>— Create account</div>
              <h1 className="h-display" style={{ fontSize: 38, margin: 0, fontWeight: 300, lineHeight: 1.05 }}>
                Start arriving<br/><span style={{ color: 'var(--amber)' }}>prepared.</span>
              </h1>
              <p style={{ color: 'var(--text-muted)', marginTop: 18, fontSize: 14, lineHeight: 1.55 }}>
                Build your first product profile in under three minutes.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="bb-label">Email</label>
                <input
                  className="bb-input"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="bb-label">Password</label>
                <input
                  className="bb-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="bb-label">Confirm password</label>
                <input
                  className="bb-input"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div style={{
                  fontSize: 13, color: 'var(--status-error)',
                  padding: '10px 14px', border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)',
                }}>
                  {error}
                </div>
              )}

              <button
                className="bb-btn-primary"
                type="submit"
                disabled={loading}
                style={{ marginTop: 10, width: '100%', padding: 14, opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <div style={{
              marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--divider)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 13, color: 'var(--text-muted)',
            }}>
              <span>Already onboard?</span>
              <Link to="/login" style={{
                color: 'var(--sapphire-sky)', fontFamily: 'Josefin Sans',
                fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 11,
              }}>
                ← Sign in
              </Link>
            </div>
          </>
        )}

        <div style={{
          position: 'absolute', bottom: -28, left: 0, right: 0,
          textAlign: 'center', color: 'var(--text-dim)',
          fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '0.04em',
        }}>
          fin consulting · battlebot v0.6
        </div>
      </div>
    </div>
  )
}