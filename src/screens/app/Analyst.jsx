import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'

const FORRESTER_FN = '/.netlify/functions/analyst-forrester'
const GARTNER_FN = '/.netlify/functions/analyst-gartner'

export default function Analyst() {
  const { productId, competitorId } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [competitor, setCompetitor] = useState(null)
  const [activeTab, setActiveTab] = useState('forrester')

  useEffect(() => {
    supabase.from('user_products').select('*').eq('id', productId).single()
      .then(({ data }) => setProduct(data))
    supabase.from('competitor_profiles').select('*').eq('id', competitorId).single()
      .then(({ data }) => setCompetitor(data))
  }, [productId, competitorId])

  if (!product || !competitor) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Dashboard" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
        Loading…
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Dashboard" breadcrumb={
        <><span>{product.product_name}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span style={{ color: 'var(--amber-gold)' }}>vs {competitor.company_name}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span>Analyst intake</span></>
      } />

      {/* Header */}
      <div style={{ padding: '28px 44px 0', borderBottom: '1px solid var(--divider)' }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>— Analyst intake</div>
        <h1 className="h-display" style={{ margin: 0, fontSize: 30, fontWeight: 300 }}>
          Forrester &amp; Gartner extraction
        </h1>
        <p style={{ margin: '8px 0 4px', color: 'var(--text-muted)', fontSize: 13 }}>
          Vendor: <span style={{ color: 'var(--text)' }}>{competitor.company_name} — {competitor.product_name}</span>
        </p>
        <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 13 }}>
          Upload pages from the report — the agent extracts, you confirm each section.
        </p>
        <div style={{ display: 'flex' }}>
          {[
            { id: 'forrester', label: 'Forrester Wave' },
            { id: 'gartner',   label: 'Gartner MQ' },
          ].map(t => (
            <div key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '12px 22px', cursor: 'pointer',
              borderBottom: activeTab === t.id ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontFamily: 'Josefin Sans', fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 12,
            }}>{t.label}</div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'forrester'
          ? <ForresterFlow key="forrester" productId={productId} competitor={competitor} />
          : <GartnerFlow   key="gartner"   productId={productId} competitor={competitor} />
        }
      </div>

      <div style={{ padding: '16px 44px', borderTop: '1px solid var(--divider)' }}>
        <button className="bb-btn-ghost"
          onClick={() => navigate(`/research/${productId}`)}>
          ← Back to research
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FORRESTER FLOW
// ─────────────────────────────────────────────────────────────
function ForresterFlow({ productId, competitor }) {
  const [phase, setPhase] = useState('setup')
  const [sessionId] = useState(() => `forrester_${competitor.id}_${Date.now()}`)
  const [agentMessage, setAgentMessage] = useState(null)
  const [currentStep, setCurrentStep] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [setup, setSetup] = useState({
    waveName: '', waveQuarter: 'Q1', waveYear: new Date().getFullYear().toString(), analystName: '',
  })

  const [imageFile, setImageFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [confidenceScore, setConfidenceScore] = useState('4')

  async function handleSetup(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(FORRESTER_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'start_extraction',
          sessionId,
          waveName: setup.waveName,
          waveQuarter: setup.waveQuarter,
          waveYear: setup.waveYear,
          analystName: setup.analystName,
          vendorName: competitor.company_name,
          productName: competitor.product_name,
        }),
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

      if (currentStep === 'awaiting_score_table') {
        if (!imageFile) throw new Error('Please upload the score table screenshot.')
        body = { ...body, mode: 'process_score_table', imageBase64: await fileToBase64(imageFile) }
      } else if (currentStep === 'awaiting_wave_graphic') {
        if (!imageFile) throw new Error('Please upload the Wave graphic screenshot.')
        body = { ...body, mode: 'process_wave_graphic', imageBase64: await fileToBase64(imageFile) }
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

  const stepMeta = {
    awaiting_score_table:     { n: '01', label: 'Score table',      input: 'image' },
    awaiting_wave_graphic:    { n: '02', label: 'Wave graphic',     input: 'image' },
    awaiting_vendor_profile:  { n: '03', label: 'Vendor profile',   input: 'paste' },
    pmm_review:               { n: '04', label: 'PMM review',       input: 'paste' },
    awaiting_confidence_score:{ n: '05', label: 'Confidence score', input: 'score' },
  }

  if (phase === 'setup') return (
    <div style={{ padding: '32px 44px', maxWidth: 600 }}>
      <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>Wave metadata</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        Enter the report details. Vendor is pre-filled from the competitor profile.
      </p>
      <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label className="bb-label">Wave name</label>
          <input className="bb-input" required placeholder="e.g. Email Marketing Service Providers"
            value={setup.waveName} onChange={e => setSetup(p => ({ ...p, waveName: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div>
            <label className="bb-label">Quarter</label>
            <select className="bb-input" value={setup.waveQuarter}
              onChange={e => setSetup(p => ({ ...p, waveQuarter: e.target.value }))}>
              {['Q1','Q2','Q3','Q4'].map(q => <option key={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className="bb-label">Year</label>
            <input className="bb-input" required placeholder="2026"
              value={setup.waveYear} onChange={e => setSetup(p => ({ ...p, waveYear: e.target.value }))} />
          </div>
          <div>
            <label className="bb-label">Analyst (optional)</label>
            <input className="bb-input" placeholder="e.g. Rusty Warner"
              value={setup.analystName} onChange={e => setSetup(p => ({ ...p, analystName: e.target.value }))} />
          </div>
        </div>
        <div style={{
          padding: '12px 16px', background: 'var(--bg)',
          border: '1px solid var(--border)', fontSize: 13,
        }}>
          <span className="eyebrow" style={{ color: 'var(--text-dim)', marginRight: 8 }}>Vendor</span>
          {competitor.company_name} — {competitor.product_name}
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

  if (phase === 'complete') return <CompleteState label="Forrester Wave" message={agentMessage} />

  return (
    <ExtractionLayout
      stepMeta={stepMeta[currentStep]}
      agentMessage={agentMessage}
      imageFile={imageFile} setImageFile={setImageFile}
      pasteText={pasteText} setPasteText={setPasteText}
      confidenceScore={confidenceScore} setConfidenceScore={setConfidenceScore}
      loading={loading} error={error}
      onSubmit={handleSubmitStep}
      sessionId={sessionId}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// GARTNER FLOW
// ─────────────────────────────────────────────────────────────
function GartnerFlow({ productId, competitor }) {
  const [phase, setPhase] = useState('setup')
  const [sessionId] = useState(() => `gartner_${competitor.id}_${Date.now()}`)
  const [agentMessage, setAgentMessage] = useState(null)
  const [currentStep, setCurrentStep] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [setup, setSetup] = useState({
    mqName: '', mqMonth: 'September', mqYear: new Date().getFullYear().toString(),
    analystNames: '', gartnerReportId: '',
  })

  const [imageFile, setImageFile] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [confidenceScore, setConfidenceScore] = useState('4')

  async function handleSetup(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(GARTNER_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'start_extraction',
          sessionId,
          mqName: setup.mqName,
          mqMonth: setup.mqMonth,
          mqYear: setup.mqYear,
          analystNames: setup.analystNames,
          gartnerReportId: setup.gartnerReportId,
          vendorName: competitor.company_name,
          productName: competitor.product_name,
        }),
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
        if (!imageFile) throw new Error('Please upload the MQ graphic screenshot.')
        body = { ...body, mode: 'process_mq_graphic', imageBase64: await fileToBase64(imageFile) }
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

  const stepMeta = {
    awaiting_mq_graphic:      { n: '01', label: 'MQ graphic',      input: 'image' },
    awaiting_vendor_profile:  { n: '02', label: 'Vendor profile',  input: 'paste' },
    pmm_review:               { n: '03', label: 'PMM review',      input: 'paste' },
    awaiting_confidence_score:{ n: '04', label: 'Confidence score', input: 'score' },
  }

  if (phase === 'setup') return (
    <div style={{ padding: '32px 44px', maxWidth: 600 }}>
      <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>MQ metadata</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        Enter the report details. Vendor is pre-filled from the competitor profile.
      </p>
      <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label className="bb-label">MQ name</label>
          <input className="bb-input" required placeholder="e.g. Multichannel Marketing Hubs"
            value={setup.mqName} onChange={e => setSetup(p => ({ ...p, mqName: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div>
            <label className="bb-label">Month</label>
            <select className="bb-input" value={setup.mqMonth}
              onChange={e => setSetup(p => ({ ...p, mqMonth: e.target.value }))}>
              {['January','February','March','April','May','June','July','August','September','October','November','December']
                .map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="bb-label">Year</label>
            <input className="bb-input" required placeholder="2025"
              value={setup.mqYear} onChange={e => setSetup(p => ({ ...p, mqYear: e.target.value }))} />
          </div>
          <div>
            <label className="bb-label">Report ID (optional)</label>
            <input className="bb-input" placeholder="e.g. G00824668"
              value={setup.gartnerReportId} onChange={e => setSetup(p => ({ ...p, gartnerReportId: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="bb-label">Analyst names (optional)</label>
          <input className="bb-input" placeholder="e.g. Mike McGuire, Tamara In"
            value={setup.analystNames} onChange={e => setSetup(p => ({ ...p, analystNames: e.target.value }))} />
        </div>
        <div style={{
          padding: '12px 16px', background: 'var(--bg)',
          border: '1px solid var(--border)', fontSize: 13,
        }}>
          <span className="eyebrow" style={{ color: 'var(--text-dim)', marginRight: 8 }}>Vendor</span>
          {competitor.company_name} — {competitor.product_name}
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

  if (phase === 'complete') return <CompleteState label="Gartner MQ" message={agentMessage} />

  return (
    <ExtractionLayout
      stepMeta={stepMeta[currentStep]}
      agentMessage={agentMessage}
      imageFile={imageFile} setImageFile={setImageFile}
      pasteText={pasteText} setPasteText={setPasteText}
      confidenceScore={confidenceScore} setConfidenceScore={setConfidenceScore}
      loading={loading} error={error}
      onSubmit={handleSubmitStep}
      sessionId={sessionId}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
function ExtractionLayout({
  stepMeta, agentMessage, imageFile, setImageFile,
  pasteText, setPasteText, confidenceScore, setConfidenceScore,
  loading, error, onSubmit, sessionId,
}) {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '260px 1fr', overflow: 'hidden' }}>
      <div style={{ borderRight: '1px solid var(--divider)', padding: '28px 24px', overflow: 'auto' }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Session</div>
        <div style={{ padding: '12px 14px', background: 'var(--bg-raised)', border: '1px solid var(--border)', marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 4, color: 'var(--amethyst-lavender)', fontSize: 9.5 }}>Session ID</div>
          <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)', fontSize: 10, wordBreak: 'break-all' }}>{sessionId}</div>
        </div>
        {stepMeta && (
          <div style={{ padding: '12px 14px', background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="eyebrow" style={{ marginBottom: 4, color: 'var(--amber)', fontSize: 9.5 }}>Current step</div>
            <div style={{ fontFamily: 'Josefin Sans', fontSize: 15, fontWeight: 300 }}>
              {stepMeta.n} — {stepMeta.label}
            </div>
          </div>
        )}
        <div style={{
          marginTop: 16, padding: '12px 14px',
          border: '1px dashed var(--border-strong)',
          fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          <div className="eyebrow" style={{ color: 'var(--amethyst-lavender)', marginBottom: 4 }}>Tip</div>
          Session persists in Supabase. You can close this tab and return — the session will resume from where you left off.
        </div>
      </div>

      <div style={{ overflow: 'auto', padding: '28px 36px' }}>
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

        {stepMeta?.input === 'image' && (
          <label style={{
            display: 'block', cursor: 'pointer', marginBottom: 20,
            border: `1px dashed ${imageFile ? 'var(--sapphire)' : 'var(--border-strong)'}`,
            padding: '32px 24px', textAlign: 'center',
            background: imageFile ? 'rgba(45,125,210,0.04)' : 'transparent',
          }}>
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => setImageFile(e.target.files[0])} />
            <div style={{
              fontFamily: 'Josefin Sans', fontSize: 14, textTransform: 'uppercase',
              letterSpacing: '0.14em', color: imageFile ? 'var(--sapphire-sky)' : 'var(--text)',
            }}>
              {imageFile ? `✓ ${imageFile.name}` : 'Upload screenshot'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              .png or .jpg · or <span style={{ color: 'var(--sapphire-sky)' }}>browse</span>
            </div>
          </label>
        )}

        {stepMeta?.input === 'paste' && (
          <textarea className="bb-input"
            style={{ minHeight: 160, resize: 'vertical', fontFamily: 'Lato', marginBottom: 20 }}
            placeholder="Paste text here…"
            value={pasteText} onChange={e => setPasteText(e.target.value)}
          />
        )}

        {stepMeta?.input === 'score' && (
          <div style={{ marginBottom: 20 }}>
            <label className="bb-label">Confidence score (1–5)</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                  onClick={() => setConfidenceScore(String(n))}
                  style={{
                    width: 48, height: 48, cursor: 'pointer',
                    background: confidenceScore === String(n) ? 'var(--amber)' : 'var(--bg-raised)',
                    border: `1px solid ${confidenceScore === String(n) ? 'var(--amber)' : 'var(--border)'}`,
                    color: confidenceScore === String(n) ? 'var(--bg)' : 'var(--text)',
                    fontFamily: 'Josefin Sans', fontWeight: 600, fontSize: 18,
                  }}>{n}</button>
              ))}
            </div>
          </div>
        )}

        {error && <ErrorBox message={error} />}

        {stepMeta?.input && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="bb-btn-primary" onClick={onSubmit} disabled={loading}
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
            padding: '20px 22px', background: 'var(--bg-raised)', border: '1px solid var(--border)',
            fontSize: 13, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap',
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}