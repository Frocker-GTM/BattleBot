import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'

const NETLIFY_FN = '/.netlify/functions/battlecard'

export default function Warmup() {
  const navigate = useNavigate()

  // Phase: 'form' | 'conversation' | 'saved'
  const [phase, setPhase] = useState('form')

  // Form data
  const [formData, setFormData] = useState({
    productName: '',
    productCategory: '',
    productDescription: '',
    industry: '',
    icp: '',
    strengths: '',
  })

  // Conversation
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [agentMessage, setAgentMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Save result
  const [savedProductId, setSavedProductId] = useState(null)
  const [savedProductName, setSavedProductName] = useState('')

  // Step tracker
  const steps = [
    { n: '01', label: 'Baseline form' },
    { n: '02', label: 'Use case framing' },
    { n: '03', label: 'Positioning statement' },
    { n: '04', label: 'Confirm & save' },
  ]

  function currentStep() {
    if (phase === 'form') return 0
    if (phase === 'saved') return 3
    if (messages.length < 4) return 1
    if (messages.length < 8) return 2
    return 3
  }

  function updateForm(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleStartWarmup(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'warmup_start', formData }),
      })
      const data = await res.json()
      setMessages(data.conversationHistory)
      setAgentMessage(data.message)
      setPhase('conversation')
    } catch (err) {
      setError('Failed to start warmup. Check your connection and try again.')
    }
    setLoading(false)
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError(null)

    const newMessages = [...messages, { role: 'user', content: input }]
    setMessages(newMessages)
    setInput('')

    try {
      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'warmup_continue', messages: newMessages }),
      })
      const data = await res.json()
      setMessages(data.conversationHistory)
      setAgentMessage(data.message)
    } catch (err) {
      setError('Failed to send message. Try again.')
    }
    setLoading(false)
  }

  async function handleConfirmAndSave() {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'save_warmup',
          formData,
          conversationHistory: messages,
          userId: user.id,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSavedProductId(data.product_id)
      setSavedProductName(formData.productName)
      setPhase('saved')
    } catch (err) {
      setError(`Save failed: ${err.message}`)
    }
    setLoading(false)
  }

  const showConfirm = agentMessage &&
    agentMessage.toLowerCase().includes('does this accurately reflect')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Dashboard" breadcrumb={<span>Warmup</span>} />

      {phase === 'saved' ? (
        // ── Saved state ──────────────────────────────────────────
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 480, textAlign: 'center',
            padding: '48px 44px', background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
          }}>
            <div className="eyebrow" style={{ color: 'var(--status-complete)', marginBottom: 14 }}>
              — Profile saved
            </div>
            <h1 className="h-display" style={{ fontSize: 32, margin: '0 0 18px', fontWeight: 300 }}>
              <span style={{ color: 'var(--amber)' }}>{savedProductName}</span> is ready.
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              Your product profile has been saved. You can now run web research and build your first battlecard.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 28 }}>
              <button className="bb-btn-ghost" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
              <button className="bb-btn-amber" onClick={() => navigate(`/research/${savedProductId}`)}>
                Go to research →
              </button>
            </div>
          </div>
        </div>

      ) : phase === 'form' ? (
        // ── Form phase ───────────────────────────────────────────
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', overflow: 'hidden' }}>

          {/* Stepper */}
          <div style={{ borderRight: '1px solid var(--divider)', padding: '32px 28px', overflow: 'auto' }}>
            <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 14 }}>— Warmup</div>
            <h2 className="h-display" style={{ fontSize: 24, margin: 0, fontWeight: 300 }}>
              Define the<br/>product profile.
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 14, lineHeight: 1.6 }}>
              Form first. Conversation second. The conversation is where the positioning sharpens.
            </p>
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {steps.map((s, i) => (
                <div key={s.n} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 14px',
                  background: i === 0 ? 'rgba(232,160,32,0.06)' : 'transparent',
                  borderLeft: `2px solid ${i === 0 ? 'var(--amber)' : 'var(--border)'}`,
                }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>{s.n}</span>
                  <span style={{
                    fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                    letterSpacing: '0.14em', fontSize: 12,
                    color: i === 0 ? 'var(--text)' : 'var(--text-dim)',
                  }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div style={{ overflow: 'auto', padding: '36px 44px' }}>
            <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>— Step 01</div>
            <h2 className="h-display" style={{ fontSize: 28, margin: '0 0 28px', fontWeight: 300 }}>
              Baseline information
            </h2>
            <form onSubmit={handleStartWarmup} style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 640 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <label className="bb-label">Product name</label>
                  <input className="bb-input" required placeholder="e.g. Klaviyo"
                    value={formData.productName} onChange={e => updateForm('productName', e.target.value)} />
                </div>
                <div>
                  <label className="bb-label">Category</label>
                  <input className="bb-input" required placeholder="e.g. Marketing automation"
                    value={formData.productCategory} onChange={e => updateForm('productCategory', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="bb-label">Product description</label>
                <textarea className="bb-input" required rows={3}
                  placeholder="What does it do and who is it for?"
                  value={formData.productDescription} onChange={e => updateForm('productDescription', e.target.value)} />
              </div>
              <div>
                <label className="bb-label">Industry</label>
                <input className="bb-input" required placeholder="e.g. B2C ecommerce"
                  value={formData.industry} onChange={e => updateForm('industry', e.target.value)} />
              </div>
              <div>
                <label className="bb-label">Ideal customer profile</label>
                <textarea className="bb-input" required rows={2}
                  placeholder="Who is your best-fit customer?"
                  value={formData.icp} onChange={e => updateForm('icp', e.target.value)} />
              </div>
              <div>
                <label className="bb-label">Known strengths</label>
                <textarea className="bb-input" required rows={2}
                  placeholder="What does your product do better than anyone else?"
                  value={formData.strengths} onChange={e => updateForm('strengths', e.target.value)} />
              </div>

              {error && (
                <div style={{
                  fontSize: 13, color: 'var(--status-error)',
                  padding: '10px 14px', border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)',
                }}>{error}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                <button className="bb-btn-amber" type="submit" disabled={loading}
                  style={{ padding: '14px 28px', opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Starting…' : 'Begin warmup →'}
                </button>
              </div>
            </form>
          </div>
        </div>

      ) : (
        // ── Conversation phase ───────────────────────────────────
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', overflow: 'hidden' }}>

          {/* Stepper + recap */}
          <div style={{ borderRight: '1px solid var(--divider)', padding: '32px 28px', overflow: 'auto' }}>
            <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 14 }}>— Warmup</div>
            <h2 className="h-display" style={{ fontSize: 24, margin: 0, fontWeight: 300 }}>
              Define the<br/>product profile.
            </h2>
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {steps.map((s, i) => {
                const step = currentStep()
                const done = i < step
                const active = i === step
                return (
                  <div key={s.n} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 14px',
                    background: active ? 'rgba(232,160,32,0.06)' : 'transparent',
                    borderLeft: `2px solid ${active ? 'var(--amber)' : done ? 'var(--sapphire)' : 'var(--border)'}`,
                  }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>{s.n}</span>
                    <span style={{
                      fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                      letterSpacing: '0.14em', fontSize: 12,
                      color: active || done ? 'var(--text)' : 'var(--text-dim)',
                    }}>{s.label}</span>
                    {done && <span style={{ marginLeft: 'auto', color: 'var(--status-complete)' }}>✓</span>}
                  </div>
                )
              })}
            </div>

            <div style={{
              marginTop: 28, padding: '16px',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
            }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Captured</div>
              {[
                ['Product', formData.productName],
                ['Category', formData.productCategory],
                ['Industry', formData.industry],
                ['ICP', formData.icp],
              ].map(([label, value]) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              padding: '20px 36px', borderBottom: '1px solid var(--divider)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div className="eyebrow">Conversation</div>
                <div style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: 500, marginTop: 4 }}>
                  {formData.productName}
                </div>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
                {messages.length} turns
              </span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '28px 36px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 18,
                }}>
                  <div style={{
                    maxWidth: '78%',
                    background: msg.role === 'user' ? 'rgba(45,125,210,0.10)' : 'var(--bg-raised)',
                    border: `1px solid ${msg.role === 'user' ? 'rgba(45,125,210,0.35)' : 'var(--border)'}`,
                    padding: '14px 18px',
                  }}>
                    <div className="eyebrow" style={{
                      color: msg.role === 'user' ? 'var(--sapphire-sky)' : 'var(--amber)',
                      marginBottom: 8, fontSize: 10,
                    }}>
                      {msg.role === 'user' ? '— You' : '— BattleBot'}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                      {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                    </div>
                    {/* Show confirm button on last assistant message if confirmation prompt detected */}
                    {msg.role === 'assistant' && i === messages.length - 1 && showConfirm && (
                      <div style={{
                        marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--divider)',
                        display: 'flex', gap: 10, alignItems: 'center',
                      }}>
                        <button className="bb-btn-amber" style={{ padding: '10px 18px' }}
                          onClick={handleConfirmAndSave} disabled={loading}>
                          {loading ? 'Saving…' : 'Confirm & save'}
                        </button>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 'auto', fontFamily: 'JetBrains Mono' }}>
                          writes to user_products
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 18 }}>
                  <div style={{
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    padding: '14px 18px',
                  }}>
                    <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8, fontSize: 10 }}>— BattleBot</div>
                    <div style={{ fontSize: 14, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>thinking…</div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ borderTop: '1px solid var(--divider)', padding: '18px 36px', background: 'var(--bg-raised)' }}>
              {error && (
                <div style={{
                  fontSize: 13, color: 'var(--status-error)', marginBottom: 10,
                  padding: '8px 12px', border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)',
                }}>{error}</div>
              )}
              <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '12px 14px',
              }}>
                <span style={{ color: 'var(--amber)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>›</span>
                <input
                  className="bb-input"
                  style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 14 }}
                  placeholder="Reply to BattleBot…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={loading}
                />
                <button className="bb-btn-ghost" type="submit" disabled={loading}
                  style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                  Send
                </button>
              </form>
              <div style={{
                marginTop: 10, fontSize: 11, color: 'var(--text-dim)',
                fontFamily: 'JetBrains Mono', display: 'flex', justifyContent: 'space-between',
              }}>
                <span>mode: warmup_continue</span>
                <span>confirm when BattleBot asks for approval</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}