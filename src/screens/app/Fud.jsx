import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'

const FUD_FN = '/.netlify/functions/fud-analysis'
const STATUS_FN = '/.netlify/functions/research-status'

export default function Fud() {
  const { productId, competitorId } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [competitor, setCompetitor] = useState(null)
  const [jobStatus, setJobStatus] = useState('idle')
  const [jobId, setJobId] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [proofPoints, setProofPoints] = useState({})
  const [savingProof, setSavingProof] = useState({})
  const [rowId, setRowId] = useState(null)
  const poller = useRef(null)

  useEffect(() => {
    supabase.from('user_products').select('*').eq('id', productId).single()
      .then(({ data }) => setProduct(data))
    supabase.from('competitor_profiles').select('*').eq('id', competitorId).single()
      .then(({ data, error }) => {
        console.log('FUD competitor fetch:', data, error)
        setCompetitor(data)
      })
    loadCandidates()
    return () => { if (poller.current) clearInterval(poller.current) }
  }, [productId, competitorId])

  async function loadCandidates() {
    console.log('loadCandidates called with competitorId:', competitorId)
    const { data } = await supabase
      .from('research_results')
      .select('id, result')
      .eq('competitor_id', competitorId)
      .eq('mode', 'fud_analysis')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log('loadCandidates result:', data)
    if (data?.result) {
      try {
        const parsed = typeof data.result === 'string'
          ? JSON.parse(data.result)
          : data.result
        setCandidates(parsed.fud_candidates || [])
        setRowId(data.id)
      } catch {}
    }
  }

  async function persistCandidates(updatedCandidates) {
    if (!rowId) return
    const { data: current } = await supabase
      .from('research_results')
      .select('result')
      .eq('id', rowId)
      .single()
    if (!current) return
    const parsed = typeof current.result === 'string'
      ? JSON.parse(current.result)
      : current.result
    parsed.fud_candidates = updatedCandidates
    await supabase
      .from('research_results')
      .update({ result: JSON.stringify(parsed) })
      .eq('id', rowId)
  }

  async function handleRunFud() {
    setJobStatus('running')
    try {
      const res = await fetch(FUD_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create_fud_job',
          productId,
          competitorId,
        }),
      })
      const data = await res.json()
	  console.log('FUD job response:', data) 
      if (data.error) throw new Error(data.error)
      setJobId(data.job_id)

      poller.current = setInterval(async () => {
        try {
          const r = await fetch(STATUS_FN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id: data.job_id }),
          })
          const d = await r.json()
          if (d.status === 'complete') {
            clearInterval(poller.current)
            setJobStatus('complete')
            await loadCandidates()
          } else if (d.status === 'error') {
            clearInterval(poller.current)
            setJobStatus('error')
          }
        } catch {}
      }, 3000)
    } catch (err) {
      setJobStatus('error')
    }
  }

  async function handleApprove(candidate) {
    const updated = candidates.map(c =>
      c.source === candidate.source && c.weakness_summary === candidate.weakness_summary
        ? { ...c, status: 'approved' }
        : c
    )
    setCandidates(updated)
    await persistCandidates(updated)
  }

  async function handleArchive(candidate) {
    const updated = candidates.filter(c =>
      !(c.source === candidate.source && c.weakness_summary === candidate.weakness_summary)
    )
    setCandidates(updated)
    await persistCandidates(updated)
  }

  async function handleSaveProof(candidate) {
    setSavingProof(prev => ({ ...prev, [candidate.source]: true }))
    const updated = candidates.map(c =>
      c.source === candidate.source && c.weakness_summary === candidate.weakness_summary
        ? { ...c, proof_point: proofPoints[candidate.source] || '' }
        : c
    )
    setCandidates(updated)
    await persistCandidates(updated)
    setSavingProof(prev => ({ ...prev, [candidate.source]: false }))
  }

  const approvedWithProof = candidates.filter(c =>
    c.status === 'approved' && c.proof_point
  ).length

  const competitorName = competitor?.company_name || '…'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Dashboard" breadcrumb={
        <><span>{product?.product_name || '…'}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span style={{ color: 'var(--amber-gold)' }}>vs {competitorName}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span>FUD</span></>
      } />

      {/* Header */}
      <div style={{ padding: '32px 44px 24px', borderBottom: '1px solid var(--divider)' }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 10 }}>— FUD analysis</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 className="h-display" style={{ margin: 0, fontSize: 32, fontWeight: 300 }}>
              {product?.product_name || '…'}
              <span style={{ color: 'var(--text-dim)', margin: '0 16px' }}>vs.</span>
              <span style={{ color: 'var(--amber-gold)' }}>{competitorName}</span>
            </h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Approve FUD candidates and complete proof points before assembly.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {jobStatus === 'running' && <StatusBadge status="running" label="Analysis running" />}
            {jobStatus === 'error' && <StatusBadge status="error" label="Error" />}
            <button
              className="bb-btn-primary"
              onClick={handleRunFud}
              disabled={jobStatus === 'running'}
              style={{ opacity: jobStatus === 'running' ? 0.5 : 1 }}>
              {candidates.length > 0 ? 'Re-run analysis' : 'Run FUD analysis →'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 44px' }}>

        {/* Empty state */}
        {candidates.length === 0 && jobStatus !== 'running' && (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            border: '1px dashed var(--border-strong)',
            color: 'var(--text-muted)', fontSize: 14, marginBottom: 24,
          }}>
            {jobStatus === 'error'
              ? 'Analysis failed. Check that research jobs are complete and try again.'
              : 'No FUD candidates yet. Run the analysis to surface candidates from your research data.'}
          </div>
        )}

        {jobStatus === 'running' && candidates.length === 0 && (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: 14, marginBottom: 24,
          }}>
            <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--sapphire-sky)', marginBottom: 8 }}>
              Running FUD gap analysis…
            </div>
            Polling for results every 3 seconds.
          </div>
        )}

        {/* Candidate list */}
        {candidates.map((c, i) => (
          <div key={i} style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            padding: '22px 24px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', fontSize: 12, paddingTop: 2 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: 500, letterSpacing: '0.02em', marginBottom: 4 }}>
                    {c.headline || c.fud_headline || c.weakness_summary}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 680 }}>
                    {c.threat_description || c.description || c.fud_angle}
                  </div>
                  {c.discovery_question && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--amethyst-lavender)', fontStyle: 'italic' }}>
                      Discovery: {c.discovery_question}
                    </div>
                  )}
                  {c.source_attribution && (
                    <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
                      {c.source_attribution}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 16 }}>
                <StatusBadge
                  status={c.status === 'approved' ? 'approved' : 'pending'}
                  label={c.status === 'approved' ? 'Approved' : 'Pending'}
                />
                {c.status !== 'approved' && (
                  <button className="bb-btn-primary" style={{ padding: '6px 14px', fontSize: 11 }}
                    onClick={() => handleApprove(c)}>
                    Approve
                  </button>
                )}
                <button className="bb-btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}
                  onClick={() => handleArchive(c)}>
                  Archive
                </button>
              </div>
            </div>

            {/* Proof point */}
            {c.status === 'approved' && (
              <div style={{
                marginTop: 14, paddingTop: 14,
                borderTop: '1px solid var(--divider)',
              }}>
                <label className="bb-label">Proof point</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    className="bb-input"
                    placeholder="Your counter-argument or proof point for this FUD…"
                    value={proofPoints[c.source] ?? (c.proof_point || '')}
                    onChange={e => setProofPoints(prev => ({ ...prev, [c.source]: e.target.value }))}
                  />
                  <button
                    className="bb-btn-ghost"
                    style={{ whiteSpace: 'nowrap', padding: '0 18px' }}
                    disabled={savingProof[c.source]}
                    onClick={() => handleSaveProof(c)}>
                    {savingProof[c.source] ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Next step */}
        <div style={{
          padding: '20px 22px', border: '1px dashed var(--border-strong)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 8,
        }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 6 }}>Next</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {approvedWithProof > 0
                ? `${approvedWithProof} candidate${approvedWithProof !== 1 ? 's' : ''} approved with proof points. Ready for assembly.`
                : 'Approve at least one FUD candidate and add a proof point to unlock assembly.'}
            </div>
          </div>
          <button
            className="bb-btn-amber"
            disabled={approvedWithProof === 0}
            style={{ opacity: approvedWithProof > 0 ? 1 : 0.4 }}
            onClick={() => navigate(`/assembly/${productId}/${competitorId}`)}>
            Battlecard assembly →
          </button>
        </div>
      </div>
    </div>
  )
}