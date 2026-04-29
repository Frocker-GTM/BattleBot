import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import HarveyBall from '../../components/HarveyBall.jsx'

const ASSEMBLY_FN = '/.netlify/functions/battlecard-assembly'
const STATUS_FN = '/.netlify/functions/research-status'

export default function Assembly() {
  const { productId, competitorId } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [competitor, setCompetitor] = useState(null)
  const [sessionId] = useState(() => `assembly_${productId}_${competitorId}_${Date.now()}`)
  const [scoringStatus, setScoringStatus] = useState('idle')
  const [swotStatus, setSwotStatus] = useState('idle')
  const [assemblyStatus, setAssemblyStatus] = useState('idle')
  const [scoringData, setScoringData] = useState(null)
  const [swotData, setSwotData] = useState(null)
  const [scoringConfirmed, setScoringConfirmed] = useState(false)
  const [swotConfirmed, setSwotConfirmed] = useState(false)
  const [battlecardId, setBattlecardId] = useState(null)
  const pollers = useRef({})

  useEffect(() => {
    supabase.from('user_products').select('*').eq('id', productId).single()
      .then(({ data }) => setProduct(data))
    supabase.from('competitor_profiles').select('*').eq('id', competitorId).single()
      .then(({ data }) => setCompetitor(data))
    return () => Object.values(pollers.current).forEach(clearInterval)
  }, [productId, competitorId])

  function startPoller(key, jobId, onComplete) {
    pollers.current[key] = setInterval(async () => {
      try {
        const r = await fetch(STATUS_FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId }),
        })
        const d = await r.json()
        if (d.status === 'complete') {
          clearInterval(pollers.current[key])
          onComplete(d)
        } else if (d.status === 'error') {
          clearInterval(pollers.current[key])
          if (key === 'scoring') setScoringStatus('error')
          if (key === 'swot') setSwotStatus('error')
        }
      } catch {}
    }, 3000)
  }

  async function handleRunScoring() {
    setScoringStatus('running')
    try {
      const res = await fetch(ASSEMBLY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create_scoring_job',
          productId,
          competitorId,
          sessionId,
        }),
      })
      const data = await res.json()
	  console.log('scoring job response:', data)
      if (data.error) throw new Error(data.error)
      startPoller('scoring', data.job_id, (result) => {
        setScoringStatus('complete')
        try {
          const parsed = typeof result.result === 'string'
            ? JSON.parse(result.result)
            : result.result
          setScoringData(parsed)
        } catch {
          setScoringData(result.result)
        }
      })
    } catch {
      setScoringStatus('error')
    }
  }

  async function handleRunSwot() {
    setSwotStatus('running')
    try {
      const res = await fetch(ASSEMBLY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create_swot_job',
          productId,
          competitorId,
          sessionId,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      startPoller('swot', data.job_id, (result) => {
        setSwotStatus('complete')
        try {
          const parsed = typeof result.result === 'string'
            ? JSON.parse(result.result)
            : result.result
          setSwotData(parsed)
        } catch {
          setSwotData(result.result)
        }
      })
    } catch {
      setSwotStatus('error')
    }
  }

  async function handleAssemble() {
    setAssemblyStatus('running')
    try {
      const res = await fetch(ASSEMBLY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'assemble_battlecard',
          productId,
          competitorId,
          sessionId,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBattlecardId(data.battlecard_id)
      setAssemblyStatus('complete')
    } catch {
      setAssemblyStatus('error')
    }
  }

  function updateScore(i, value) {
    if (!scoringData) return
    const useCases = Array.isArray(scoringData)
      ? [...scoringData]
      : [...(scoringData.scored_use_cases || [])]
    useCases[i] = { ...useCases[i], uc_our_score: parseInt(value) }
    setScoringData(Array.isArray(scoringData) ? useCases : { ...scoringData, scored_use_cases: useCases })
  }

  function updateSwotBullet(quadrant, index, value) {
    if (!swotData) return
    const updated = { ...swotData }
    const key = quadrant.toLowerCase()
    updated[key] = [...(updated[key] || [])]
    updated[key][index] = value
    setSwotData(updated)
  }

  const competitorName = competitor?.company_name || '…'
  const useCases = Array.isArray(scoringData)
    ? scoringData
    : (scoringData?.scored_use_cases || [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Dashboard" breadcrumb={
        <><span>{product?.product_name || '…'}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span style={{ color: 'var(--amber-gold)' }}>vs {competitorName}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span>Assembly</span></>
      } />

      {/* Header */}
      <div style={{ padding: '28px 44px 22px', borderBottom: '1px solid var(--divider)' }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>— Assembly</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 className="h-display" style={{ margin: 0, fontSize: 30, fontWeight: 300 }}>
            Three confirmations from a battlecard
          </h1>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
            writes to battlecard_versions
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 44px' }}>

        {/* Panel 1 — Scoring */}
        <AssemblyPanel
          n="01" title="Use case scoring"
          status={scoringConfirmed ? 'approved' : scoringStatus === 'idle' ? 'pending' : scoringStatus}
          locked={false}
          subtitle={scoringConfirmed ? 'Harvey balls confirmed.' : 'Score each use case 0–4 for your product vs the competitor.'}
        >
          {scoringStatus === 'idle' && (
            <button className="bb-btn-primary" onClick={handleRunScoring}>
              Run use case scoring →
            </button>
          )}
          {scoringStatus === 'running' && (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
              Scoring in progress — polling for results…
            </div>
          )}
          {scoringStatus === 'error' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ color: 'var(--status-error)', fontSize: 13 }}>Scoring failed.</span>
              <button className="bb-btn-ghost" onClick={handleRunScoring}>Retry</button>
            </div>
          )}
          {scoringStatus === 'complete' && useCases.length > 0 && !scoringConfirmed && (
            <>
              <div style={{ marginBottom: 18 }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 80px 80px 1fr',
                  gap: 14, padding: '8px 0', borderBottom: '1px solid var(--divider)', marginBottom: 6,
                }}>
                  {['Use case', product?.product_name || 'Yours', competitorName, 'Rationale'].map((h, i) => (
                    <span key={i} className="eyebrow" style={{
                      fontSize: 9.5,
                      color: i === 1 ? 'var(--sapphire-sky)' : i === 2 ? 'var(--amber-gold)' : undefined,
                      textAlign: i === 1 || i === 2 ? 'center' : undefined,
                    }}>{h}</span>
                  ))}
                </div>
                {useCases.map((uc, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1.5fr 80px 80px 1fr',
                    gap: 14, padding: '12px 0', alignItems: 'center',
                    borderBottom: '1px solid var(--divider)',
                  }}>
                    <span style={{ fontSize: 13.5 }}>{uc.uc_name || uc.use_case || uc.name}</span>
                    <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <HarveyBall value={uc.uc_our_score ?? uc.score ?? 0} size={20} color="#5FA8E8" />
                      <select
                        value={uc.uc_our_score ?? uc.score ?? 0}
                        onChange={e => updateScore(i, e.target.value)}
                        style={{
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                          color: 'var(--text)', fontSize: 11, padding: '2px 4px',
                          fontFamily: 'JetBrains Mono',
                        }}>
                        {[0,1,2,3,4].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <HarveyBall value={uc.uc_their_score ?? uc.competitor_score ?? 0} size={20} color="#F2C46D" />
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{uc.uc_rationale || uc.rationale}</span>
                  </div>
                ))}
              </div>
              <button className="bb-btn-amber" onClick={() => setScoringConfirmed(true)}>
                Confirm scores →
              </button>
            </>
          )}
          {scoringConfirmed && (
            <div style={{ color: 'var(--status-complete)', fontSize: 13, fontFamily: 'JetBrains Mono' }}>
              ✓ Scores confirmed
            </div>
          )}
        </AssemblyPanel>

        {/* Panel 2 — SWOT */}
        <AssemblyPanel
          n="02" title="SWOT — competitor perspective"
          status={swotConfirmed ? 'approved' : swotStatus === 'idle' ? 'pending' : swotStatus}
          locked={!scoringConfirmed}
          subtitle="From the competitor's vantage. Edit any bullet before confirming."
        >
          {!scoringConfirmed ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Complete scoring first.</div>
          ) : swotStatus === 'idle' ? (
            <button className="bb-btn-primary" onClick={handleRunSwot}>Run SWOT generation →</button>
          ) : swotStatus === 'running' ? (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
              Generating SWOT — polling for results…
            </div>
          ) : swotStatus === 'error' ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ color: 'var(--status-error)', fontSize: 13 }}>SWOT generation failed.</span>
              <button className="bb-btn-ghost" onClick={handleRunSwot}>Retry</button>
            </div>
          ) : swotStatus === 'complete' && swotData && !swotConfirmed ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                {[
                  { key: 'strengths',     label: 'Strengths',     color: '#86EFAC', bg: 'rgba(74,222,128,0.04)' },
                  { key: 'weaknesses',    label: 'Weaknesses',    color: '#FCA5A5', bg: 'rgba(239,68,68,0.04)' },
                  { key: 'opportunities', label: 'Opportunities', color: '#5FA8E8', bg: 'rgba(45,125,210,0.04)' },
                  { key: 'threats',       label: 'Threats',       color: '#F2C46D', bg: 'rgba(232,160,32,0.04)' },
                ].map(({ key, label, color, bg }) => (
                  <div key={key} style={{ background: bg, border: `1px solid ${color}33`, padding: '16px 18px' }}>
                    <div className="eyebrow" style={{ color, marginBottom: 10 }}>{label}</div>
                    {(swotData.swot?.[key] || swotData[key] || []).map((bullet, i) => (
                      <input key={i} className="bb-input"
                        style={{ marginBottom: 8, fontSize: 13 }}
                        value={bullet}
                        onChange={e => updateSwotBullet(key, i, e.target.value)}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <button className="bb-btn-amber" onClick={() => setSwotConfirmed(true)}>
                Confirm SWOT →
              </button>
            </>
          ) : swotConfirmed ? (
            <div style={{ color: 'var(--status-complete)', fontSize: 13, fontFamily: 'JetBrains Mono' }}>
              ✓ SWOT confirmed
            </div>
          ) : null}
        </AssemblyPanel>

        {/* Panel 3 — Assemble */}
        <AssemblyPanel
          n="03" title="Assemble battlecard"
          status={assemblyStatus === 'idle' ? 'pending' : assemblyStatus}
          locked={!swotConfirmed}
          subtitle="One write to battlecard_versions. Previous version archives automatically."
        >
          {!swotConfirmed ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Complete SWOT first.</div>
          ) : assemblyStatus === 'complete' && battlecardId ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ color: 'var(--status-complete)', fontSize: 13, fontFamily: 'JetBrains Mono' }}>
                ✓ Battlecard assembled
              </div>
              <button className="bb-btn-amber" onClick={() => navigate(`/battlecard/${battlecardId}`)}>
                View battlecard →
              </button>
            </div>
          ) : assemblyStatus === 'error' ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ color: 'var(--status-error)', fontSize: 13 }}>Assembly failed.</span>
              <button className="bb-btn-ghost" onClick={handleAssemble}>Retry</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Scoring confirmed · SWOT confirmed · Ready to assemble.
              </div>
              <button className="bb-btn-amber" style={{ padding: '14px 26px' }}
                onClick={handleAssemble}
                disabled={assemblyStatus === 'running'}>
                {assemblyStatus === 'running' ? 'Assembling…' : 'Assemble battlecard →'}
              </button>
            </div>
          )}
        </AssemblyPanel>

      </div>
    </div>
  )
}

function AssemblyPanel({ n, title, subtitle, status, locked, children }) {
  return (
    <div style={{
      background: 'var(--bg-raised)', border: '1px solid var(--border)',
      padding: '24px 28px', marginBottom: 18,
      opacity: locked ? 0.45 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', fontSize: 12 }}>{n}</span>
          <div>
            <h3 className="font-display" style={{
              margin: 0, fontSize: 18, fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>{title}</h3>
            {subtitle && <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>{subtitle}</p>}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      {children}
    </div>
  )
}