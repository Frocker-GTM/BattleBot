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

  // Competitor resolution
  const [companyName, setCompanyName] = useState('')
  const [productName, setProductName] = useState('')
  const [competitor, setCompetitor] = useState(null) // full competitor_profiles record
  const [competitorStatus, setCompetitorStatus] = useState('idle') // idle | searching | found | created | error
  const [competitorMessage, setCompetitorMessage] = useState(null)

  // Taxonomy
  const [taxonomy, setTaxonomy] = useState(null)
  const [taxonomyLoading, setTaxonomyLoading] = useState(false)

  // Research jobs
  const [jobs, setJobs] = useState({
    g2:            { status: 'pending', result: null, expanded: false, jobId: null },
    trustradius:   { status: 'pending', result: null, expanded: false, jobId: null },
    gartner_peers: { status: 'pending', result: null, expanded: false, jobId: null },
    website:       { status: 'pending', result: null, expanded: false, jobId: null },
  })

  const pollers = useRef({})

  useEffect(() => {
    supabase.from('user_products').select('*').eq('id', productId).single()
      .then(({ data }) => setProduct(data))
    return () => Object.values(pollers.current).forEach(clearInterval)
  }, [productId])

  async function handleFindOrCreateCompetitor() {
    if (!companyName.trim()) return
    setCompetitorStatus('searching')
    setCompetitorMessage(null)
    setCompetitor(null)

    try {
      // Search for existing profile
      const { data: existing } = await supabase
        .from('competitor_profiles')
        .select('*')
        .ilike('company_name', companyName.trim())
        .ilike('product_name', productName.trim() || '%')
        .limit(1)
        .maybeSingle()

      if (existing) {
        setCompetitor(existing)
        setCompetitorStatus('found')
        setCompetitorMessage(`Found existing profile for ${existing.company_name} — ${existing.product_name}.`)
        return
      }

      // Not found — create one using AI overview
      const { data: { user } } = await supabase.auth.getUser()

      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'competitor_overview',
          competitor: companyName.trim(),
          productName: productName.trim(),
        }),
      })
      const overviewData = await res.json()
      const description = overviewData.result || ''

      const { data: created, error } = await supabase
        .from('competitor_profiles')
        .insert({
          company_name: companyName.trim(),
          product_name: productName.trim() || companyName.trim(),
          description,
          created_by: user.id,
        })
        .select('*')
        .single()

      if (error) throw new Error(error.message)

      setCompetitor(created)
      setCompetitorStatus('created')
      setCompetitorMessage(`Created new competitor profile for ${created.company_name}.`)

    } catch (err) {
      setCompetitorStatus('error')
      setCompetitorMessage(`Error: ${err.message}`)
    }
  }

  async function handleResolveTaxonomy() {
    if (!competitor) return
    setTaxonomyLoading(true)
    setTaxonomy(null)
    try {
      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'resolve_taxonomy',
          competitor: competitor.company_name,
          productName: competitor.product_name,
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
          competitor: competitor.company_name,
          productName: competitor.product_name,
          competitorId: competitor.id,
        }),
      })
      const data = await res.json()
      const jobId = data.job_id

      setJobs(prev => ({ ...prev, [source]: { ...prev[source], jobId } }))

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
  const competitorReady = competitor !== null

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
              <span style={{ color: 'var(--amber-gold)' }}>
                {competitor ? competitor.company_name : '…'}
              </span>
            </h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Find or create a competitor profile, then run research jobs.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="bb-btn-ghost"
              disabled={!competitorReady}
              style={{ opacity: competitorReady ? 1 : 0.4 }}
              onClick={() => navigate(`/analyst/${productId}/${competitor.id}`)}>
              Analyst reports
            </button>
            <button className="bb-btn-primary"
              disabled={!competitorReady}
              style={{ opacity: competitorReady ? 1 : 0.4 }}
              onClick={handleRunAll}>
              Run all four →
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 44px' }}>

        {/* Step 1 — Competitor resolution */}
        <div style={{
          background: 'var(--bg-raised)', border: `1px solid ${competitorReady ? 'var(--sapphire)' : 'var(--border)'}`,
          padding: '22px 24px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="eyebrow">
              {competitorReady ? '✓ Competitor resolved' : 'Step 1 — Find or create competitor'}
            </div>
            {competitor && (
              <button className="bb-btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }}
                onClick={() => { setCompetitor(null); setCompetitorStatus('idle'); setCompetitorMessage(null) }}>
                Change
              </button>
            )}
          </div>

          {!competitorReady ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 14, alignItems: 'flex-end' }}>
                <div>
                  <label className="bb-label">Company name</label>
                  <input className="bb-input" placeholder="e.g. Salesforce"
                    value={companyName} onChange={e => setCompanyName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFindOrCreateCompetitor()} />
                </div>
                <div>
                  <label className="bb-label">Specific product</label>
                  <input className="bb-input" placeholder="e.g. Marketing Cloud (optional)"
                    value={productName} onChange={e => setProductName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFindOrCreateCompetitor()} />
                </div>
                <button className="bb-btn-primary"
                  disabled={competitorStatus === 'searching' || !companyName.trim()}
                  style={{ whiteSpace: 'nowrap', opacity: !companyName.trim() ? 0.4 : 1 }}
                  onClick={handleFindOrCreateCompetitor}>
                  {competitorStatus === 'searching' ? 'Searching…' : 'Find or create →'}
                </button>
              </div>
              {competitorMessage && (
                <div style={{
                  marginTop: 12, fontSize: 13, padding: '8px 12px',
                  color: competitorStatus === 'error' ? 'var(--status-error)' : 'var(--text-muted)',
                  border: `1px solid ${competitorStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                  background: competitorStatus === 'error' ? 'rgba(239,68,68,0.08)' : 'var(--bg)',
                }}>{competitorMessage}</div>
              )}
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              <div>
                <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 4 }}>Company</div>
                <div style={{ fontSize: 15, fontFamily: 'Josefin Sans', fontWeight: 500 }}>{competitor.company_name}</div>
              </div>
              <div>
                <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 4 }}>Product</div>
                <div style={{ fontSize: 15, fontFamily: 'Josefin Sans', fontWeight: 500 }}>{competitor.product_name}</div>
              </div>
              <div>
                <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 4 }}>Status</div>
                <StatusBadge status={competitorStatus === 'found' ? 'complete' : 'approved'}
                  label={competitorStatus === 'found' ? 'Existing profile' : 'New profile'} />
              </div>
              <div>
                <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 4 }}>Profile ID</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
                  {competitor.id.slice(0, 8)}…
                </div>
              </div>
              {competitor.description && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{competitor.description}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2 — Taxonomy resolver */}
        <div style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          padding: '22px 24px', marginBottom: 20,
          opacity: competitorReady ? 1 : 0.4,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: taxonomy ? 14 : 0 }}>
            <div className="eyebrow">Step 2 — Taxonomy resolver</div>
            <button className="bb-btn-ghost"
              disabled={!competitorReady || taxonomyLoading}
              style={{ whiteSpace: 'nowrap' }}
              onClick={handleResolveTaxonomy}>
              {taxonomyLoading ? 'Resolving…' : taxonomy ? 'Re-resolve' : 'Resolve taxonomy'}
            </button>
          </div>
          {taxonomy && (
            <div style={{
              marginTop: 14, padding: '14px 16px',
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

        {/* Step 3 — Research jobs */}
        <div className="eyebrow" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          <span>Step 3 — Web research jobs</span>
          <span style={{ color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', letterSpacing: 0 }}>
            4 sources · weighted
          </span>
        </div>

        <div style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          marginBottom: 24, opacity: competitorReady ? 1 : 0.4,
        }}>
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
                    <span onClick={() => toggleExpanded(source)} style={{
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
                      disabled={!competitorReady}
                      onClick={() => handleRunJob(source)}>
                      Run
                    </button>
                  )}
                </div>
              </div>
              {job.expanded && job.result && (
                <div style={{
                  padding: '16px 22px 20px',
                  fontSize: 13, color: 'var(--text-muted)',
                  lineHeight: 1.7, whiteSpace: 'pre-wrap',
                  borderTop: '1px solid var(--divider)',
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
              {!competitorReady
                ? 'Resolve a competitor profile to unlock research.'
                : anyComplete
                  ? 'Research complete. Run FUD analysis or add analyst reports to raise source weight.'
                  : 'Run at least one research job to unlock FUD analysis.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="bb-btn-ghost"
              disabled={!competitorReady}
              style={{ opacity: competitorReady ? 1 : 0.4 }}
              onClick={() => navigate(`/analyst/${productId}/${competitor?.id}`)}>
              Analyst reports
            </button>
            <button className="bb-btn-amber"
              disabled={!anyComplete || !competitorReady}
              style={{ opacity: anyComplete && competitorReady ? 1 : 0.4 }}
              onClick={() => navigate(`/fud/${productId}/${competitor?.id}`)}>
              FUD analysis →
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}