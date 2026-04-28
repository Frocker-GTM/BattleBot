import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'

const FORRESTER_FN = '/.netlify/functions/analyst-forrester'
const GARTNER_FN = '/.netlify/functions/analyst-gartner'

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
          Multi-step PMM review. Upload the page, the agent extracts, you confirm.
          Session state persists in{' '}
          <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>analyst_sessions</span>.
        </p>
        <div style={{ display: 'flex' }}>
          {[
            { id: 'forrester', label: 'Forrester Wave', sub: '5 steps' },
            { id: 'gartner',   label: 'Gartner MQ',    sub: '5 steps' },
          ].map(t => (
            <div key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '12px 22px', cursor: 'pointer',
              borderBottom: activeTab === t.id ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--text)' : 'var(--text-muted)',
            }}>
              <div style={{ fontFamily: 'Josefin Sans', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 12 }}>
                {t.label}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>{t.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'forrester'
          ? <ForresterFlow key="forrester" productId={productId} product={product} />
          : <GartnerFlow   key="gartner"   productId={productId} product={product} />
        }
      </div>

      <div style={{ padding: '16px 44px', borderTop: '1px solid var(--divider)' }}>
        <button className="bb-btn-ghost" onClick={() => navigate(`/research/${productId}`)}>
          ← Back to research
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FORRESTER FLOW
// ─────────────────────────────────────────────────────────────
function ForresterFlow({ productId, product }) {
  const [phase, setPhase] = useState('setup') // setup | extracting | complete
  const [sessionId] = useState(() => `forrester_${productId}_${Date.now()}`)
  const [agentMessage, setAgentMessage] = useState(null)
  const [currentStep, setCurrentStep] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Setup form
  const [setup, setSetup] = useState({
    waveName: '', waveQuarter: '', waveYear: '',
    analystName: '', vendorName: '', productName: '',
  })

  // Per-step inputs
  const [imageFile, setImageFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [confidenceScore, setConfidenceScore] = useState('5')

  async function handleSetup(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(FORRESTER_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'start_extraction', sessionId, ...setup }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAgentMessage(data.message)
      setCurrentStep(data.step)
      setPhase('extracting')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function handleSubmitStep() {
    setLoading(true)
    setError(null)
    try {
      let body = { sessionId }

      if (currentStep === 'awaiting_score_table' || currentStep === 'awaiting_wave_graphic') {
        // Image required
        if (!imageFile) throw new Error('Please upload an image for this step.')
        const base64 = await fileToBase64(imageFile)
        const mode = currentStep === 'awaiting_score_table' ? 'process_score_table' : 'process_wave_graphic'
        body = { ...body, mode, imageBase64: base64 }
      } else if (currentStep === 'awaiting_vendor_profile') {
        if (!pasteText.trim()) throw new Error('Please paste the vendor profile text.')
        body = { ...body, mode: 'process_vendor_profile', profileText: pasteText }
      } else if (currentStep === 'pmm_review') {
        if (!pasteText.trim()) throw new Error('Please enter your review.')
        body = { ...body, mode: 'submit_pmm_review', pmmResponse: pasteText }
      } else if (currentStep === 'awaiting_confidence_score') {
        body = { ...body, mode: 'submit_confidence_score', confidenceScore }
      }

      const res = await fetch(FORRESTER_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.debug_error) throw new Error(data.debug_error)
      if (data.error) throw new Error(data.error)

      setAgentMessage(data.message)
      setCurrentStep(data.step)
      setImageFile(null)
      setPasteText('')

      if (data.step === 'complete') setPhase('complete')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  const stepLabels = {
    awaiting_score_table:    { n: 1, label: 'Score table',      input: 'image' },
    awaiting_wave_graphic:   { n: 2, label: 'Wave graphic',     input: 'image' },
    awaiting_vendor_profile: { n: 3, label: 'Vendor profile',   input: 'paste' },
    pmm_review:              { n: 4, label: 'PMM review',        input: 'paste' },
    awaiting_confidence_score:{ n: 5, label: 'Confidence score', input: 'score' },
    complete:                { n: 5, label: 'Complete',          input: null },
  }

  const stepInfo = stepLabels[currentStep] || {}

  if (phase === 'setup') {
    return (
      <div style={{ padding: '32px 44px', maxWidth: 680 }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>Forrester Wave — Setup</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
          Enter the report metadata before uploading any pages.
          The session will persist across all 5 steps.
        </p>
        <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label className="bb-label">Wave name</label>
              <input className="bb-input" required placeholder="e.g. Email Marketing"
                value={setup.waveName} onChange={e => setSetup(p => ({ ...p, waveName: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Quarter</label>
              <input className="bb-input" required placeholder="e.g. Q1"
                value={setup.waveQuarter} onChange={e => setSetup(p => ({ ...p, waveQuarter: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Year</label>
              <input className="bb-input" required placeholder="e.g. 2026"
                value={setup.waveYear} onChange={e => setSetup(p => ({ ...p, waveYear: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="bb-label">Vendor name</label>
              <input className="bb-input" required placeholder="e.g. Cordial"
                value={setup.vendorName} onChange={e => setSetup(p => ({ ...p, vendorName: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Product name</label>
              <input className="bb-input" placeholder="e.g. Cordial Edge (optional)"
                value={setup.productName} onChange={e => setSetup(p => ({ ...p, productName: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="bb-label">Analyst name (optional)</label>
            <input className="bb-input" placeholder="e.g. Rusty Warner"
              value={setup.analystName} onChange={e => setSetup(p => ({ ...p, analystName: e.target.value }))} />
          </div>
          {error && <ErrorBox message={error} />}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="bb-btn-amber" type="submit" disabled={loading}
              style={{ padding: '12px 28px', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Starting…' : 'Start extraction →'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <CompleteState label="Forrester Wave" message={agentMessage} />
    )
  }

  return (
    <ExtractionLayout
      stepInfo={stepInfo}
      agentMessage={agentMessage}
      imageFile={imageFile}
      setImageFile={setImageFile}
      pasteText={pasteText}
      setPasteText={setPasteText}
      confidenceScore={confidenceScore}
      setConfidenceScore={setConfidenceScore}
      loading={loading}
      error={error}
      onSubmit={handleSubmitStep}
      sessionId={sessionId}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// GARTNER FLOW
// ─────────────────────────────────────────────────────────────
function GartnerFlow({ productId, product }) {
  const [phase, setPhase] = useState('setup')
  const [sessionId] = useState(() => `gartner_${productId}_${Date.now()}`)
  const [agentMessage, setAgentMessage] = useState(null)
  const [currentStep, setCurrentStep] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [setup, setSetup] = useState({
    mqName: '', mqMonth: '', mqYear: '',
    analystNames: '', gartnerReportId: '',
    vendorName: '', productName: '',
  })

  const [imageFile, setImageFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [confidenceScore, setConfidenceScore] = useState('5')

  async function handleSetup(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(GARTNER_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'start_extraction', sessionId, ...setup }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAgentMessage(data.message)
      setCurrentStep(data.step)
      setPhase('extracting')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function handleSubmitStep() {
    setLoading(true)
    setError(null)
    try {
      let body = { sessionId }

      if (currentStep === 'awaiting_mq_graphic') {
        if (!imageFile) throw new Error('Please upload an image for this step.')
        const base64 = await fileToBase64(imageFile)
        body = { ...body, mode: 'process_mq_graphic', imageBase64: base64 }
      } else if (currentStep === 'awaiting_vendor_profile') {
        if (!pasteText.trim()) throw new Error('Please paste the vendor profile text.')
        body = { ...body, mode: 'process_vendor_profile', profileText: pasteText }
      } else if (currentStep === 'pmm_review') {
        if (!pasteText.trim()) throw new Error('Please enter your review.')
        body = { ...body, mode: 'submit_pmm_review', pmmResponse: pasteText }
      } else if (currentStep === 'awaiting_confidence_score') {
        body = { ...body, mode: 'submit_confidence_score', confidenceScore }
      }

      const res = await fetch(GARTNER_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.debug_error) throw new Error(data.debug_error)
      if (data.error) throw new Error(data.error)

      setAgentMessage(data.message)
      setCurrentStep(data.step)
      setImageFile(null)
      setPasteText('')

      if (data.step === 'complete') setPhase('complete')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  const stepLabels = {
    awaiting_mq_graphic:      { n: 1, label: 'MQ graphic',       input: 'image' },
    awaiting_vendor_profile:  { n: 2, label: 'Vendor profile',   input: 'paste' },
    pmm_review:               { n: 3, label: 'PMM review',        input: 'paste' },
    awaiting_confidence_score:{ n: 4, label: 'Confidence score',  input: 'score' },
    complete:                 { n: 4, label: 'Complete',           input: null },
  }

  const stepInfo = stepLabels[currentStep] || {}

  if (phase === 'setup') {
    return (
      <div style={{ padding: '32px 44px', maxWidth: 680 }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>Gartner MQ — Setup</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
          Enter the report metadata before uploading any pages.
        </p>
        <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label className="bb-label">MQ name</label>
              <input className="bb-input" required placeholder="e.g. Multichannel Marketing Hubs"
                value={setup.mqName} onChange={e => setSetup(p => ({ ...p, mqName: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Month</label>
              <input className="bb-input" required placeholder="e.g. September"
                value={setup.mqMonth} onChange={e => setSetup(p => ({ ...p, mqMonth: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Year</label>
              <input className="bb-input" required placeholder="e.g. 2025"
                value={setup.mqYear} onChange={e => setSetup(p => ({ ...p, mqYear: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="bb-label">Vendor name</label>
              <input className="bb-input" required placeholder="e.g. Cordial"
                value={setup.vendorName} onChange={e => setSetup(p => ({ ...p, vendorName: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Product name (optional)</label>
              <input className="bb-input" placeholder="e.g. Cordial Edge"
                value={setup.productName} onChange={e => setSetup(p => ({ ...p, productName: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="bb-label">Analyst names (optional)</label>
              <input className="bb-input" placeholder="e.g. Mike McGuire"
                value={setup.analystNames} onChange={e => setSetup(p => ({ ...p, analystNames: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Gartner report ID (optional)</label>
              <input className="bb-input" placeholder="e.g. G00123456"
                value={setup.gartnerReportId} onChange={e => setSetup(p => ({ ...p, gartnerReportId: e.target.value }))} />
            </div>
          </div>
          {error && <ErrorBox message={error} />}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="bb-btn-amber" type="submit" disabled={loading}
              style={{ padding: '12px 28px', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Starting…' : 'Start extraction →'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (phase === 'complete') {
    return <CompleteState label="Gartner MQ" message={agentMessage} />
  }

  return (
    <ExtractionLayout
      stepInfo={stepInfo}
      agentMessage={agentMessage}
      imageFile={imageFile}
      setImageFile={setImageFile}
      pasteText={pasteText}
      setPasteText={setPasteText}
      confidenceScore={confidenceScore}
      setConfidenceScore={setConfidenceScore}
      loading={loading}
      error={error}
      onSubmit={handleSubmitStep}
      sessionId={sessionId}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
function ExtractionLayout({
  stepInfo, agentMessage, imageFile, setImageFile,
  pasteText, setPasteText, confidenceScore, setConfidenceScore,
  loading, error, onSubmit, sessionId
}) {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>

      {/* Session sidebar */}
      <div style={{ borderRight: '1px solid var(--divider)', padding: '28px 24px', overflow: 'auto' }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Session state</div>
        <div style={{ padding: '14px 16px', background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
          <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--amethyst-lavender)' }}>Session ID</div>
          <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)', fontSize: 10, wordBreak: 'break-all' }}>
            {sessionId}
          </div>
        </div>
        {stepInfo.n && (
          <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--amber)' }}>Current step</div>
            <div style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: 300 }}>
              {stepInfo.n} — {stepInfo.label}
            </div>
          </div>
        )}
        <div style={{
          marginTop: 20, padding: '14px 16px',
          border: '1px dashed var(--border-strong)',
          fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          <div className="eyebrow" style={{ color: 'var(--amethyst-lavender)', marginBottom: 6 }}>Note</div>
          Session state persists in Supabase. You can close this tab and return — the session will resume.
        </div>
      </div>

      {/* Active step */}
      <div style={{ overflow: 'auto', padding: '28px 36px' }}>

        {/* Agent message */}
        {agentMessage && (
          <div style={{
            marginBottom: 24, padding: '20px 22px',
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
          }}>
            <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 10 }}>— BattleBot</div>
            <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
              {agentMessage}
            </div>
          </div>
        )}

        {/* Input area */}
        {stepInfo.input === 'image' && (
          <label style={{
            display: 'block',
            border: `1px dashed ${imageFile ? 'var(--sapphire)' : 'var(--border-strong)'}`,
            padding: '28px 24px', textAlign: 'center',
            background: imageFile ? 'rgba(45,125,210,0.04)' : 'rgba(45,125,210,0.02)',
            marginBottom: 20, cursor: 'pointer',
          }}>
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => setImageFile(e.target.files[0])} />
            <div style={{
              fontFamily: 'Josefin Sans', fontSize: 14, textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: imageFile ? 'var(--sapphire-sky)' : 'var(--text)',
            }}>
              {imageFile ? `✓ ${imageFile.name}` : 'Upload screenshot'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              .png or .jpg · or <span style={{ color: 'var(--sapphire-sky)' }}>browse</span>
            </div>
          </label>
        )}

        {stepInfo.input === 'paste' && (
          <textarea
            className="bb-input"
            style={{ minHeight: 160, resize: 'vertical', fontFamily: 'Lato', marginBottom: 20 }}
            placeholder="Paste text here…"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
        )}

        {stepInfo.input === 'score' && (
          <div style={{ marginBottom: 20 }}>
            <label className="bb-label">Confidence score (1–5)</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                  onClick={() => setConfidenceScore(String(n))}
                  style={{
                    width: 48, height: 48,
                    background: confidenceScore === String(n) ? 'var(--amber)' : 'var(--bg-raised)',
                    border: `1px solid ${confidenceScore === String(n) ? 'var(--amber)' : 'var(--border)'}`,
                    color: confidenceScore === String(n) ? 'var(--bg)' : 'var(--text)',
                    fontFamily: 'Josefin Sans', fontWeight: 600, fontSize: 18,
                    cursor: 'pointer',
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <ErrorBox message={error} />}

        {stepInfo.input && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="bb-btn-primary" onClick={onSubmit}
              disabled={loading}
              style={{ padding: '12px 28px', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Processing…' : 'Submit →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CompleteState({ label, message }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 44 }}>
      <div style={{ maxWidth: 600 }}>
        <div className="eyebrow" style={{ color: 'var(--status-complete)', marginBottom: 14 }}>
          — {label} complete
        </div>
        {message && (
          <div style={{
            padding: '20px 22px', background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            fontSize: 13, lineHeight: 1.75, color: 'var(--text)',
            whiteSpace: 'pre-wrap',
          }}>{message}</div>
        )}
      </div>
    </div>
  )
}

function ErrorBox({ message }) {
  return (
    <div style={{
      fontSize: 13, color: 'var(--status-error)', marginBottom: 16,
      padding: '10px 14px', border: '1px solid rgba(239,68,68,0.3)',
      background: 'rgba(239,68,68,0.08)',
    }}>{message}</div>
  )
}

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}