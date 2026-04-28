import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'

const NETLIFY_FN_FORRESTER = '/.netlify/functions/analyst-forrester'
const NETLIFY_FN_GARTNER = '/.netlify/functions/analyst-gartner'

export default function Analyst() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [activeTab, setActiveTab] = useState('forrester')

  useEffect(() => {
    supabase.from('user_products').select('*').eq('id', productId).single()
      .then(({ data }) => setProduct(data))
  }, [productId])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Dashboard" breadcrumb={
        <><span>{product?.product_name || '…'}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span>Analyst intake</span></>
      } />

      {/* Header */}
      <div style={{ padding: '28px 44px 0', borderBottom: '1px solid var(--divider)' }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>— Analyst intake</div>
        <h1 className="h-display" style={{ margin: 0, fontSize: 30, fontWeight: 300 }}>
          Forrester &amp; Gartner extraction
        </h1>
        <p style={{ margin: '8px 0 18px', color: 'var(--text-muted)', fontSize: 13, maxWidth: 720 }}>
          Multi-step PMM review. Upload the page, the agent extracts, you confirm. Session state persists in{' '}
          <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>analyst_sessions</span>.
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            { id: 'forrester', label: 'Forrester Wave', steps: '5 steps' },
            { id: 'gartner',   label: 'Gartner MQ',    steps: '8 steps' },
          ].map(t => (
            <div key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '12px 22px', cursor: 'pointer',
              borderBottom: activeTab === t.id ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--text)' : 'var(--text-muted)',
            }}>
              <div style={{
                fontFamily: 'Josefin Sans', fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 12,
              }}>{t.label}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>
                {t.steps}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'forrester' ? (
          <AnalystFlow
            key="forrester"
            productId={productId}
            fnUrl={NETLIFY_FN_FORRESTER}
            analyst="forrester"
            totalSteps={5}
            stepLabels={[
              'Wave graphic',
              'Criterion scores',
              'Customer feedback',
              'Strengths / weaknesses',
              'Confirm extraction',
            ]}
          />
        ) : (
          <AnalystFlow
            key="gartner"
            productId={productId}
            fnUrl={NETLIFY_FN_GARTNER}
            analyst="gartner"
            totalSteps={8}
            stepLabels={[
              'MQ graphic',
              'Completeness of vision',
              'Ability to execute',
              'Customer feedback',
              'Strengths',
              'Cautions',
              'Use cases',
              'Confirm extraction',
            ]}
          />
        )}
      </div>

      {/* Back link */}
      <div style={{
        padding: '16px 44px', borderTop: '1px solid var(--divider)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <button className="bb-btn-ghost" onClick={() => navigate(`/research/${productId}`)}>
          ← Back to research
        </button>
      </div>
    </div>
  )
}

function AnalystFlow({ productId, fnUrl, analyst, totalSteps, stepLabels }) {
  const [step, setStep] = useState(1)
  const [sessionId] = useState(() => `${analyst}_${productId}_${Date.now()}`)
  const [pasteText, setPasteText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [agentResponse, setAgentResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [complete, setComplete] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setAgentResponse(null)

    try {
      let body = {
        session_id: sessionId,
        step,
        product_id: productId,
      }

      if (imageFile) {
        // Convert image to base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })
        body.image = base64
        body.image_type = imageFile.type
      } else {
        body.text = pasteText
      }

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAgentResponse(data.message || data.result || JSON.stringify(data))
    } catch (err) {
      setError(`Submission failed: ${err.message}`)
    }
    setLoading(false)
  }

  function handleAdvance() {
    if (step >= totalSteps) {
      setComplete(true)
    } else {
      setStep(s => s + 1)
      setPasteText('')
      setImageFile(null)
      setAgentResponse(null)
      setError(null)
    }
  }

  if (complete) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 44 }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <div className="eyebrow" style={{ color: 'var(--status-complete)', marginBottom: 14 }}>— Complete</div>
          <h2 className="h-display" style={{ fontSize: 28, margin: '0 0 14px', fontWeight: 300 }}>
            Extraction complete.
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
            All {totalSteps} steps confirmed. Data saved to analyst_sessions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>

      {/* Stepper */}
      <div style={{ borderRight: '1px solid var(--divider)', padding: '28px 24px', overflow: 'auto' }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          {analyst === 'forrester' ? 'Forrester Wave' : 'Gartner MQ'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {stepLabels.map((label, i) => {
            const n = i + 1
            const done = n < step
            const active = n === step
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, flexShrink: 0,
                  border: `1px solid ${done ? 'var(--sapphire)' : active ? 'var(--amber)' : 'var(--border-strong)'}`,
                  background: active ? 'rgba(232,160,32,0.10)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'JetBrains Mono', fontSize: 11,
                  color: done ? 'var(--sapphire-sky)' : active ? 'var(--amber-gold)' : 'var(--text-dim)',
                }}>
                  {done ? '✓' : n}
                </div>
                <span style={{
                  fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                  letterSpacing: '0.14em', fontSize: 11,
                  color: active || done ? 'var(--text)' : 'var(--text-dim)',
                }}>{label}</span>
              </div>
            )
          })}
        </div>

        <div style={{
          marginTop: 28, padding: '14px 16px',
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
        }}>
          <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--amethyst-lavender)' }}>Session</div>
          <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)', fontSize: 11 }}>{sessionId}</div>
        </div>
      </div>

      {/* Active step */}
      <div style={{ overflow: 'auto', padding: '28px 36px' }}>
        <div className="eyebrow" style={{ color: 'var(--amber)' }}>— Step {String(step).padStart(2,'0')} of {String(totalSteps).padStart(2,'0')}</div>
        <h2 className="h-display" style={{ margin: '6px 0 6px', fontSize: 24, fontWeight: 300 }}>
          {stepLabels[step - 1]}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
          Upload a screenshot or paste text from this section of the report.
        </p>

        {/* Upload zone */}
        <label style={{
          display: 'block',
          border: `1px dashed ${imageFile ? 'var(--sapphire)' : 'var(--border-strong)'}`,
          padding: '28px 24px', textAlign: 'center',
          background: imageFile ? 'rgba(45,125,210,0.04)' : 'rgba(45,125,210,0.02)',
          marginBottom: 18, cursor: 'pointer',
        }}>
          <input type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { setImageFile(e.target.files[0]); setPasteText('') }} />
          <div style={{
            fontFamily: 'Josefin Sans', fontSize: 14,
            color: imageFile ? 'var(--sapphire-sky)' : 'var(--text)',
            textTransform: 'uppercase', letterSpacing: '0.14em',
          }}>
            {imageFile ? `✓ ${imageFile.name}` : 'Drop page screenshot'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
            .png or .jpg up to 8MB · or <span style={{ color: 'var(--sapphire-sky)' }}>browse</span>
          </div>
        </label>

        <div style={{
          fontFamily: 'JetBrains Mono', fontSize: 11,
          color: 'var(--text-dim)', textAlign: 'center', margin: '0 0 14px',
        }}>— or paste —</div>

        <textarea
          className="bb-input"
          style={{ minHeight: 120, resize: 'vertical', fontFamily: 'Lato', marginBottom: 20 }}
          placeholder="Paste text from this section of the report…"
          value={pasteText}
          onChange={e => { setPasteText(e.target.value); setImageFile(null) }}
        />

        {error && (
          <div style={{
            fontSize: 13, color: 'var(--status-error)', marginBottom: 16,
            padding: '10px 14px', border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.08)',
          }}>{error}</div>
        )}

        {/* Agent response */}
        {agentResponse && (
          <div style={{
            marginBottom: 20, padding: '20px 22px',
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="eyebrow" style={{ color: 'var(--amber)' }}>Agent extraction · review</div>
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
              whiteSpace: 'pre-wrap',
            }}>{agentResponse}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {!agentResponse ? (
            <button className="bb-btn-primary" onClick={handleSubmit}
              disabled={loading || (!pasteText.trim() && !imageFile)}
              style={{ opacity: loading || (!pasteText.trim() && !imageFile) ? 0.5 : 1 }}>
              {loading ? 'Extracting…' : 'Submit for extraction →'}
            </button>
          ) : (
            <>
              <button className="bb-btn-ghost" onClick={() => setAgentResponse(null)}>
                Re-submit
              </button>
              <button className="bb-btn-primary" onClick={handleAdvance}>
                {step >= totalSteps ? 'Complete extraction ✓' : 'Confirm & advance →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}