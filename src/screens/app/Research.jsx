import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'

const NETLIFY_FN = '/.netlify/functions/battlecard'
const STATUS_FN = '/.netlify/functions/research-status'

export default function Research() {
  const { productId } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [competitor, setCompetitor] = useState('')
  const [competitorProduct, setCompetitorProduct] = useState('')
  const [taxonomy, setTaxonomy] = useState(null)
  const [taxonomyLoading, setTaxonomyLoading] = useState(false)

  const [jobs, setJobs] = useState({
    g2:              { status: 'pending', result: null, expanded: false, jobId: null },
    trustradius:     { status: 'pending', result: null, expanded: false, jobId: null },
    gartner_peers:   { status: 'pending', result: null, expanded: false, jobId: null },
    website:         { status: 'pending', result: null, expanded: false, jobId: null },
  })

  const pollers = useRef({})

  useEffect(() => {
    supabase.from('user_products').select('*').eq('id', productId).single()
      .then(({ data }) => setProduct(data))
    return () => Object.values(pollers.current).forEach(clearInterval)
  }, [productId])

  async function handleResolveTaxonomy() {
    if (!competitor.trim()) return
    setTaxonomyLoading(true)
    setTaxonomy(null)
    try {
      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'resolve_taxonomy',
          competitor,
          productName: competitorProduct,
        }),
      })
      const data = await res.json()
      setTaxonomy(data.message)
    } catch (err) {
      setTaxonomy('Failed to resolve taxonomy. Try again.')
    }
    setTaxonomyLoading(false)
  }

  async function handleRunJob(source) {
    const modeMap = {
      g2:            'research_g2',
      trustradius:   'research_trustradius',
      gartner_peers: 'research_gartner_peers',
      website:       'research_website',
    }

    setJobs(prev => ({ ...prev, [source]: { ...prev[source], status: 'running' } }))

    try {
      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create_research_job',
          researchMode: modeMap[source],
          competitor,
          productName: competitorProduct,
        }),
      })
      const data = await res.json()
      const jobId = data.job_id

      setJobs(prev => ({ ...prev, [source]: { ...prev[source], jobId } }))

      // Poll for completion
      pollers.current[source] = setInterval(async () => {
        try {
          const r = await fetch(STATUS_FN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id: jobId }),
          })
          const d = await r.json()
          if (d.status === 'complete') {
            clearInterval(pollers.current[source])
            setJobs(prev => ({ ...prev, [source]: { ...prev[source], status: 'complete', result: d.result } }))
          } else if (d.status === 'error') {
            clearInterval(pollers.current[source])
            setJobs(prev => ({ ...prev, [source]: { ...prev[source], status: 'error' } }))
          }
        } catch {}
      }, 3000)

    } catch (err) {
      setJobs(prev => ({ ...prev, [source]: { ...prev[source], status: 'error' } }))
    }
  }

  async function handleRunAll() {
    for (const source of ['g2', 'trustradius', 'gartner_peers', 'website']) {
      if (jobs[source].status === 'pending') await handleRunJob(source)
    }
  }

  function toggleExpanded(source) {
    setJobs(prev => ({ ...prev, [source]: { ...prev[source], expanded: !prev[source].expanded } }))
  }

  const anyComplete = Object.values(jobs).some(j => j.status === 'complete')

  const sourceLabels = {
    g2:            'G2',
    trustradius:   'TrustRadius',
    gartner_peers: 'Gartner Peer Insights',
    website:       'Competitor website',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Dashboard" breadcrumb={
        <><span>{product?.product_name || '…'}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span>Research</span></>
      } />

      {/* Header */}
      <div style={{ padding: '32px 44px 24px', borderBottom: '1px solid var(--divider)' }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 10 }}>— Live research</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 className="h-display" style={{ margin: 0, fontSize: 32, fontWeight: 300 }}>
              {product?.product_name || '…'}
              <span style={{ color: 'var(--text-dim)', margin: '0 16px' }}>vs.</span>
              <span style={{ color: 'var(--amber-gold)' }}>{competitor || '…'}</span>
            </h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Set the competitor, resolve taxonomy, then run research jobs.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="bb-btn-ghost" onClick={() => navigate(`/analyst/${productId}`)}>
              Analyst reports
            </button>
            <button className="bb-btn-primary" onClick={handleRunAll}
              disabled={!competitor.trim()}>
              Run all four →
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 44px' }}>

        {/* Competitor inputs */}
        <div style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          padding: '22px 24px', marginBottom: 20,
        }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Competitor</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 14, alignItems: 'flex-end' }}>
            <div>
              <label className="bb-label">Company name</label>
              <input className="bb-input" placeholder="e.g. Cordial"
                value={competitor} onChange={e => setCompetitor(e.target.value)} />
            </div>
            <div>
              <label className="bb-label">Specific product</label>
              <input className="bb-input" placeholder="e.g. Cordial Edge"
                value={competitorProduct} onChange={e => setCompetitorProduct(e.target.value)} />
            </div>
            <button className="bb-btn-ghost" onClick={handleResolveTaxonomy}
              disabled={taxonomyLoading || !competitor.trim()}
              style={{ whiteSpace: 'nowrap' }}>
              {taxonomyLoading ? 'Resolving…' : 'Resolve taxonomy'}
            </button>
          </div>

          {taxonomy && (
            <div style={{
              marginTop: 16, padding: '14px 16px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              <div className="eyebrow" style={{ color: 'var(--amethyst-lavender)', marginBottom: 8 }}>
                Taxonomy resolution
              </div>
              {taxonomy}
            </div>
          )}
        </div>

        {/* Research jobs */}
        <div className="eyebrow" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          <span>Web research jobs</span>
          <span style={{ color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', letterSpacing: 0 }}>
            4 sources · weighted
          </span>
        </div>

        <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', marginBottom: 24 }}>
          {Object.entries(jobs).map(([source, job]) => (
            <div key={source} style={{ borderBottom: '1px solid var(--divider)' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '200px 140px 1fr 120px',
                alignItems: 'center', gap: 20, padding: '18px 22px',
              }}>
                <div>
                  <div style={{ fontFamily: 'Josefin Sans', fontSize: 14, fontWeight: 500 }}>
                    {sourceLabels[source]}
                  </div>
                  <div className="eyebrow" style={{ color: 'var(--text-dim)', marginTop: 2, fontSize: 9.5 }}>
                    research_results
                  </div>
                </div>
                <StatusBadge status={job.status} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {job.status === 'running' && 'Running — polling for results…'}
                  {job.status === 'complete' && 'Complete — results ready'}
                  {job.status === 'error' && 'Error — try running again'}
                  {job.status === 'pending' && 'Ready to run'}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {job.status === 'complete' ? (
                    <span
                      onClick={() => toggleExpanded(source)}
                      style={{
                        fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                        letterSpacing: '0.14em', fontSize: 11,
                        color: 'var(--sapphire-sky)', cursor: 'pointer',
                      }}>
                      {job.expanded ? 'Hide ↑' : 'View →'}
                    </span>
                  ) : job.status === 'running' ? (
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
                      polling…
                    </span>
                  ) : (
                    <button className="bb-btn-ghost"
                      style={{ padding: '7px 14px', fontSize: 10.5 }}
                      disabled={!competitor.trim()}
                      onClick={() => handleRunJob(source)}>
                      Run
                    </button>
                  )}
                </div>
              </div>

              {job.expanded && job.result && (
                <div style={{
                  padding: '0 22px 20px',
                  fontSize: 13, color: 'var(--text-muted)',
                  lineHeight: 1.7, whiteSpace: 'pre-wrap',
                  borderTop: '1px solid var(--divider)',
                  paddingTop: 16,
                }}>
                  {job.result}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Next steps */}
        <div style={{
          padding: '20px 22px', border: '1px dashed var(--border-strong)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 6 }}>Next</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {anyComplete
                ? 'Research complete. Run FUD analysis or add analyst reports to raise source weight.'
                : 'Run at least one research job to unlock FUD analysis.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="bb-btn-ghost" onClick={() => navigate(`/analyst/${productId}`)}>
              Analyst reports
            </button>
            <button
              className="bb-btn-amber"
              disabled={!anyComplete || !competitor.trim()}
              onClick={() => navigate(`/fud/${productId}/${encodeURIComponent(competitor)}`)}
              style={{ opacity: anyComplete && competitor.trim() ? 1 : 0.4 }}>
              FUD analysis →
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}