// src/screens/app/Analyst.jsx
// Fix 1 — Correct named mode mapping for analyst-forrester.js and analyst-gartner.js
// All modes now match the function's expected values exactly per Section 4.2 / 4.3 of docs.

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const FORRESTER_FN = '/.netlify/functions/analyst-forrester'
const GARTNER_FN   = '/.netlify/functions/analyst-gartner'

// ─────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────

function AgentMessage({ message }) {
  if (!message) return null
  return (
    <div className="bb-agent-message" style={{ marginBottom: '1.5rem' }}>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message}</p>
    </div>
  )
}

function ErrorBox({ message }) {
  if (!message) return null
  return (
    <div className="bb-error-box" style={{ marginBottom: '1rem' }}>
      {message}
    </div>
  )
}

function CompleteState({ label, message }) {
  return (
    <div className="bb-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
      <h3 style={{ marginBottom: '0.75rem' }}>{label} Extraction Complete</h3>
      {message && <p style={{ color: 'var(--bb-text-muted)', margin: 0 }}>{message}</p>}
    </div>
  )
}

// Shared extraction layout for steps 2+ (image upload or paste + confidence)
function ExtractionLayout({
  stepInfo, agentMessage, imageFile, setImageFile,
  pasteText, setPasteText, confidenceScore, setConfidenceScore,
  loading, error, onSubmit, sessionId
}) {
  const isConfidenceStep = stepInfo?.mode === 'submit_confidence_score'
  const isPmmReviewStep  = stepInfo?.mode === 'submit_pmm_review'

  return (
    <div className="bb-card">
      <div style={{ marginBottom: '1rem' }}>
        <span className="bb-badge">{stepInfo?.label || 'Step'}</span>
      </div>

      <AgentMessage message={agentMessage} />

      {isConfidenceStep ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="bb-label">Confidence Score (1–5)</label>
          <p style={{ color: 'var(--bb-text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            How confident are you in the accuracy of this extraction? (1 = low, 5 = high)
          </p>
          <input
            className="bb-input"
            type="number" min="1" max="5"
            value={confidenceScore}
            onChange={e => setConfidenceScore(e.target.value)}
          />
        </div>
      ) : (
        <>
          {/* Image upload — for graphic steps */}
          {stepInfo?.acceptsImage && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="bb-label">Upload Image (optional)</label>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'block', marginTop: '0.25rem' }}
                onChange={e => setImageFile(e.target.files[0] || null)}
              />
              {imageFile && (
                <p style={{ color: 'var(--bb-text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Selected: {imageFile.name}
                </p>
              )}
            </div>
          )}

          {/* Text / paste area */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="bb-label">
              {isPmmReviewStep ? 'Your corrections or context' : 'Paste text or describe what you see'}
            </label>
            <textarea
              className="bb-textarea"
              rows={6}
              placeholder={
                isPmmReviewStep
                  ? 'Add any corrections, clarifications, or additional context for the analyst...'
                  : 'Paste text from the report, or describe the graphic / placement...'
              }
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
          </div>
        </>
      )}

      <ErrorBox message={error} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="bb-btn-amber"
          onClick={onSubmit}
          disabled={loading}
          style={{ padding: '12px 28px', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Processing…' : (stepInfo?.buttonLabel || 'Submit →')}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FORRESTER FLOW
// Mode sequence:
//   setup → start_extraction
//   process_score_table → process_wave_graphic → process_vendor_profile
//   → submit_pmm_review → submit_confidence_score → complete
// ─────────────────────────────────────────────────────────────

const FORRESTER_STEPS = [
  { mode: 'process_score_table',    label: 'Step 2 — Score Table',      acceptsImage: true,  buttonLabel: 'Submit score table →' },
  { mode: 'process_wave_graphic',   label: 'Step 3 — Wave Graphic',     acceptsImage: true,  buttonLabel: 'Submit wave graphic →' },
  { mode: 'process_vendor_profile', label: 'Step 4 — Vendor Profile',   acceptsImage: false, buttonLabel: 'Submit vendor profile →' },
  { mode: 'submit_pmm_review',      label: 'Step 5 — PMM Review',       acceptsImage: false, buttonLabel: 'Submit review →' },
  { mode: 'submit_confidence_score',label: 'Step 6 — Confidence Score', acceptsImage: false, buttonLabel: 'Save & finish →' },
]

function ForresterFlow({ productId, product }) {
  const [phase, setPhase]               = useState('setup')
  const [sessionId]                     = useState(() => `forrester_${productId}_${Date.now()}`)
  const [agentMessage, setAgentMessage] = useState(null)
  const [stepIndex, setStepIndex]       = useState(0)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)

  const [setup, setSetup] = useState({
    waveName: '', waveQuarter: '', waveYear: '',
    analystName: '', vendorName: '', productName: product?.product_name || '',
  })

  const [imageFile, setImageFile]           = useState(null)
  const [pasteText, setPasteText]           = useState('')
  const [confidenceScore, setConfidenceScore] = useState('5')

  // ── Step 1: setup form → start_extraction ──
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
          waveName:     setup.waveName,
          waveQuarter:  setup.waveQuarter,
          waveYear:     setup.waveYear,
          analystName:  setup.analystName,
          vendorName:   setup.vendorName,
          productName:  setup.productName,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAgentMessage(data.message)
      setPhase('extracting')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // ── Steps 2-6: named modes ──
  async function handleSubmitStep() {
    setLoading(true)
    setError(null)
    const stepInfo = FORRESTER_STEPS[stepIndex]

    try {
      let pmmResponse = pasteText

      // If an image was uploaded, convert to base64 and include it
      if (stepInfo.acceptsImage && imageFile) {
        const base64 = await fileToBase64(imageFile)
        pmmResponse = pasteText
          ? `[IMAGE ATTACHED]\n\n${pasteText}`
          : '[IMAGE ATTACHED - no additional text]'
        // Note: actual image data would need to be handled by the function
        // For now we flag its presence in pmmResponse text
        // If analyst-forrester.js accepts base64 images, extend body below
      }

      // For confidence score step, override pmmResponse
      if (stepInfo.mode === 'submit_confidence_score') {
        pmmResponse = confidenceScore
      }

      const body = {
        mode: stepInfo.mode,
        sessionId,
        pmmResponse,
      }

      const res = await fetch(FORRESTER_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setAgentMessage(data.message || null)
      setImageFile(null)
      setPasteText('')

      const isLast = stepIndex >= FORRESTER_STEPS.length - 1
      if (isLast) {
        setPhase('complete')
      } else {
        setStepIndex(i => i + 1)
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (phase === 'complete') {
    return <CompleteState label="Forrester Wave" message={agentMessage} />
  }

  if (phase === 'setup') {
    return (
      <div className="bb-card">
        <h3 style={{ marginBottom: '1.25rem' }}>Forrester Wave Setup</h3>
        <p style={{ color: 'var(--bb-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Enter the Wave details before uploading report content.
        </p>
        <form onSubmit={handleSetup}>
          <div className="bb-form-grid">
            <div>
              <label className="bb-label">Wave Name</label>
              <input className="bb-input" required placeholder="e.g. Email Marketing Solutions"
                value={setup.waveName} onChange={e => setSetup(p => ({ ...p, waveName: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Quarter</label>
              <input className="bb-input" required placeholder="Q1"
                value={setup.waveQuarter} onChange={e => setSetup(p => ({ ...p, waveQuarter: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Year</label>
              <input className="bb-input" required placeholder="2025"
                value={setup.waveYear} onChange={e => setSetup(p => ({ ...p, waveYear: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Lead Analyst</label>
              <input className="bb-input" required placeholder="e.g. Rusty Warner"
                value={setup.analystName} onChange={e => setSetup(p => ({ ...p, analystName: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Vendor Name</label>
              <input className="bb-input" required placeholder="e.g. Klaviyo"
                value={setup.vendorName} onChange={e => setSetup(p => ({ ...p, vendorName: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Product Name</label>
              <input className="bb-input" required placeholder="e.g. Klaviyo"
                value={setup.productName} onChange={e => setSetup(p => ({ ...p, productName: e.target.value }))} />
            </div>
          </div>
          <ErrorBox message={error} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button className="bb-btn-amber" type="submit" disabled={loading}
              style={{ padding: '12px 28px', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Starting…' : 'Start extraction →'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // phase === 'extracting'
  const stepInfo = FORRESTER_STEPS[stepIndex]
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
// Mode sequence:
//   setup → start_extraction
//   process_mq_graphic → process_vendor_profile
//   → submit_pmm_review → submit_confidence_score → complete
// ─────────────────────────────────────────────────────────────

const GARTNER_STEPS = [
  { mode: 'process_mq_graphic',     label: 'Step 2 — MQ Graphic',       acceptsImage: true,  buttonLabel: 'Submit MQ graphic →' },
  { mode: 'process_vendor_profile', label: 'Step 3 — Vendor Profile',   acceptsImage: false, buttonLabel: 'Submit vendor profile →' },
  { mode: 'submit_pmm_review',      label: 'Step 4 — PMM Review',       acceptsImage: false, buttonLabel: 'Submit review →' },
  { mode: 'submit_confidence_score',label: 'Step 5 — Confidence Score', acceptsImage: false, buttonLabel: 'Save & finish →' },
]

function GartnerFlow({ productId, product }) {
  const [phase, setPhase]               = useState('setup')
  const [sessionId]                     = useState(() => `gartner_${productId}_${Date.now()}`)
  const [agentMessage, setAgentMessage] = useState(null)
  const [stepIndex, setStepIndex]       = useState(0)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)

  const [setup, setSetup] = useState({
    mqName: '', mqMonth: '', mqYear: '',
    analystNames: '', gartnerReportId: '',
    vendorName: '', productName: product?.product_name || '',
  })

  const [imageFile, setImageFile]               = useState(null)
  const [pasteText, setPasteText]               = useState('')
  const [confidenceScore, setConfidenceScore]   = useState('5')

  // ── Step 1: setup form → start_extraction ──
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
          mqName:           setup.mqName,
          mqMonth:          setup.mqMonth,
          mqYear:           setup.mqYear,
          analystNames:     setup.analystNames,
          gartnerReportId:  setup.gartnerReportId,
          vendorName:       setup.vendorName,
          productName:      setup.productName,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAgentMessage(data.message)
      setPhase('extracting')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // ── Steps 2-5: named modes ──
  async function handleSubmitStep() {
    setLoading(true)
    setError(null)
    const stepInfo = GARTNER_STEPS[stepIndex]

    try {
      let pmmResponse = pasteText

      if (stepInfo.mode === 'submit_confidence_score') {
        pmmResponse = confidenceScore
      }

      const body = {
        mode: stepInfo.mode,
        sessionId,
        pmmResponse,
      }

      const res = await fetch(GARTNER_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setAgentMessage(data.message || null)
      setImageFile(null)
      setPasteText('')

      const isLast = stepIndex >= GARTNER_STEPS.length - 1
      if (isLast) {
        setPhase('complete')
      } else {
        setStepIndex(i => i + 1)
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (phase === 'complete') {
    return <CompleteState label="Gartner Magic Quadrant" message={agentMessage} />
  }

  if (phase === 'setup') {
    return (
      <div className="bb-card">
        <h3 style={{ marginBottom: '1.25rem' }}>Gartner Magic Quadrant Setup</h3>
        <p style={{ color: 'var(--bb-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Enter the MQ details before uploading report content.
        </p>
        <form onSubmit={handleSetup}>
          <div className="bb-form-grid">
            <div>
              <label className="bb-label">Magic Quadrant Name</label>
              <input className="bb-input" required placeholder="e.g. Email Marketing Platforms"
                value={setup.mqName} onChange={e => setSetup(p => ({ ...p, mqName: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Month Published</label>
              <input className="bb-input" required placeholder="e.g. October"
                value={setup.mqMonth} onChange={e => setSetup(p => ({ ...p, mqMonth: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Year Published</label>
              <input className="bb-input" required placeholder="2025"
                value={setup.mqYear} onChange={e => setSetup(p => ({ ...p, mqYear: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Analyst Name(s)</label>
              <input className="bb-input" required placeholder="e.g. Adam Sarner, Mike Froggatt"
                value={setup.analystNames} onChange={e => setSetup(p => ({ ...p, analystNames: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Gartner Report ID (optional)</label>
              <input className="bb-input" placeholder="e.g. G00123456"
                value={setup.gartnerReportId} onChange={e => setSetup(p => ({ ...p, gartnerReportId: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Vendor Name</label>
              <input className="bb-input" required placeholder="e.g. Klaviyo"
                value={setup.vendorName} onChange={e => setSetup(p => ({ ...p, vendorName: e.target.value }))} />
            </div>
            <div>
              <label className="bb-label">Product Name</label>
              <input className="bb-input" required placeholder="e.g. Klaviyo"
                value={setup.productName} onChange={e => setSetup(p => ({ ...p, productName: e.target.value }))} />
            </div>
          </div>
          <ErrorBox message={error} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button className="bb-btn-amber" type="submit" disabled={loading}
              style={{ padding: '12px 28px', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Starting…' : 'Start extraction →'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // phase === 'extracting'
  const stepInfo = GARTNER_STEPS[stepIndex]
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
// Utility: File → Base64
// ─────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ─────────────────────────────────────────────────────────────
// ANALYST — top-level screen
// ─────────────────────────────────────────────────────────────

export default function Analyst() {
  const { productId } = useParams()
  const [product, setProduct]       = useState(null)
  const [activeTab, setActiveTab]   = useState('forrester')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  useEffect(() => {
    async function loadProduct() {
      const { data, error } = await supabase
        .from('user_products')
        .select('id, product_name, category')
        .eq('id', productId)
        .single()
      if (error) setError(error.message)
      else setProduct(data)
      setLoading(false)
    }
    loadProduct()
  }, [productId])

  if (loading) return <div className="bb-loading">Loading…</div>
  if (error)   return <div className="bb-error-box">Error: {error}</div>

  return (
    <div className="bb-screen">
      <div className="bb-screen-header">
        <h2>Analyst Reports</h2>
        {product && (
          <p style={{ color: 'var(--bb-text-muted)', margin: '0.25rem 0 0' }}>
            {product.product_name}
          </p>
        )}
      </div>

      {/* Tab selector */}
      <div className="bb-tab-bar" style={{ marginBottom: '1.5rem' }}>
        <button
          className={`bb-tab ${activeTab === 'forrester' ? 'bb-tab-active' : ''}`}
          onClick={() => setActiveTab('forrester')}
        >
          Forrester Wave
        </button>
        <button
          className={`bb-tab ${activeTab === 'gartner' ? 'bb-tab-active' : ''}`}
          onClick={() => setActiveTab('gartner')}
        >
          Gartner Magic Quadrant
        </button>
      </div>

      {activeTab === 'forrester' && (
        <ForresterFlow productId={productId} product={product} />
      )}
      {activeTab === 'gartner' && (
        <GartnerFlow productId={productId} product={product} />
      )}
    </div>
  )
}
