import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'

const NETLIFY_FN = '/.netlify/functions/battlecard'
const STATUS_FN = '/.netlify/functions/research-status'

const SOURCE_LABELS = {
  g2:            { label: 'G2',                   mode: 'research_g2' },
  trustradius:   { label: 'TrustRadius',           mode: 'research_trustradius' },
  gartner_peers: { label: 'Gartner Peer Insights', mode: 'research_gartner_peers' },
  website:       { label: 'Competitor website',    mode: 'research_website' },
}

export default function Research() {
  const { productId } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)

  // Competitor list + selection
  const [competitors, setCompetitors] = useState([])
  const [competitor, setCompetitor] = useState(null)
  const [showAddNew, setShowAddNew] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newProductName, setNewProductName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  // Taxonomy conversation
  const [taxonomyMessages, setTaxonomyMessages] = useState([])
  const [taxonomyInput, setTaxonomyInput] = useState('')
  const [taxonomyLoading, setTaxonomyLoading] = useState(false)
  const [taxonomyConfirmed, setTaxonomyConfirmed] = useState(false)

  // Research jobs — keyed by source
  const [jobs, setJobs] = useState({
    g2:            { status: 'pending', result: null, expanded: false, jobId: null },
    trustradius:   { status: 'pending', result: null, expanded: false, jobId: null },
    gartner_peers: { status: 'pending', result: null, expanded: false, jobId: null },
    website:       { status: 'pending', result: null, expanded: false, jobId: null },
  })

  const pollers = useRef({})
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Load product + all competitor profiles on mount
  useEffect(() => {
    supabase.from('user_products').select('*').eq('id', productId).single()
      .then(({ data }) => setProduct(data))
    supabase.from('competitor_profiles').select('*').order('company_name')
      .then(({ data }) => setCompetitors(data || []))
    return () => Object.values(pollers.current).forEach(clearInterval)
  }, [productId])

  // When a competitor is selected, load existing research results
  async function selectCompetitor(comp) {
    setCompetitor(comp)
    setTaxonomyMessages([])
    setTaxonomyConfirmed(false)
    setJobs({
      g2:            { status: 'pending', result: null, expanded: false, jobId: null },
      trustradius:   { status: 'pending', result: null, expanded: false, jobId: null },
      gartner_peers: { status: 'pending', result: null, expanded: false, jobId: null },
      website:       { status: 'pending', result: null, expanded: false, jobId: null },
    })

    // Load existing research results for this competitor
    const { data: existing } = await supabase
      .from('research_results')
      .select('*')
      .eq('competitor_id', comp.id)
      .in('mode', ['research_g2', 'research_trustradius', 'research_gartner_peers', 'research_website'])
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
	  
	console.log('existing research results:', existing)  

    if (existing && existing.length > 0) {
      // For each source, use the most recent complete result
      const latest = {}
      existing.forEach(r => {
        const key = r.mode.replace('research_', '').replace('gartner_peers', 'gartner_peers')
        const sourceKey = Object.keys(SOURCE_LABELS).find(k => SOURCE_LABELS[k].mode === r.mode)
        if (sourceKey && !latest[sourceKey]) {
          latest[sourceKey] = r
        }
      })

      setJobs(prev => {
        const updated = { ...prev }
        Object.entries(latest).forEach(([key, row]) => {
          updated[key] = { status: 'complete', result: row.result, expanded: false, jobId: row.job_id }
        })
        return updated
      })
    }
  }

  async function handleCreateCompetitor(e) {
    e.preventDefault()
    if (!newCompanyName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Get AI overview
      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'competitor_overview',
          competitor: newCompanyName.trim(),
          productName: newProductName.trim(),
        }),
      })
      const overviewData = await res.json()

      const { data: created, error } = await supabase
        .from('competitor_profiles')
        .insert({
          company_name: newCompanyName.trim(),
          product_name: newProductName.trim() || newCompanyName.trim(),
          description: overviewData.result || '',
          created_by: user.id,
        })
        .select('*')
        .single()

      if (error) throw new Error(error.message)

      setCompetitors(prev => [...prev, created].sort((a, b) => a.company_name.localeCompare(b.company_name)))
      setShowAddNew(false)
      setNewCompanyName('')
      setNewProductName('')
      await selectCompetitor(created)
    } catch (err) {
      setCreateError(err.message)
    }
    setCreating(false)
  }

  async function handleResolveTaxonomy() {
    if (!competitor) return
    setTaxonomyLoading(true)
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
      setTaxonomyMessages([{ role: 'assistant', content: data.message }])
    } catch {
      setTaxonomyMessages([{ role: 'assistant', content: 'Failed to resolve taxonomy. Try again.' }])
    }
    setTaxonomyLoading(false)
  }

  async function handleTaxonomyReply(e) {
    e.preventDefault()
    if (!taxonomyInput.trim()) return
    setTaxonomyLoading(true)
    const newMessages = [...taxonomyMessages, { role: 'user', content: taxonomyInput }]
    setTaxonomyMessages(newMessages)
    setTaxonomyInput('')
    try {
      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'warmup_continue', messages: newMessages }),
      })
      const data = await res.json()
      setTaxonomyMessages(data.conversationHistory)
    } catch {
      setTaxonomyMessages(prev => [...prev, { role: 'assistant', content: 'Error — try again.' }])
    }
    setTaxonomyLoading(false)
  }

  async function handleRunJob(source) {
    setJobs(prev => ({ ...prev, [source]: { ...prev[source], status: 'running' } }))
    try {
      const res = await fetch(NETLIFY_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create_research_job',
          researchMode: SOURCE_LABELS[source].mode,
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
    } catch {
      setJobs(prev => ({ ...prev, [source]: { ...prev[source], status: 'error' } }))
    }
  }

  async function handleDeleteResearch(source) {
    const jobId = jobs[source].jobId
    if (!jobId) return
    const { data: rows } = await supabase
      .from('research_results')
      .select('id')
      .eq('job_id', jobId)
    if (rows && rows.length > 0) {
      await supabase.from('research_results').delete().eq('job_id', jobId)
    }
    setJobs(prev => ({
      ...prev,
      [source]: { status: 'pending', result: null, expanded: false, jobId: null }
    }))
  }

  async function handleDeleteCompetitor(comp) {
    await supabase.from('research_results').delete().eq('competitor_id', comp.id)
    await supabase.from('competitor_profiles').delete().eq('id', comp.id)
    setCompetitors(prev => prev.filter(c => c.id !== comp.id))
    setDeleteConfirm(null)
    if (competitor?.id === comp.id) {
      setCompetitor(null)
      setJobs({
        g2:            { status: 'pending', result: null, expanded: false, jobId: null },
        trustradius:   { status: 'pending', result: null, expanded: false, jobId: null },
        gartner_peers: { status: 'pending', result: null, expanded: false, jobId: null },
        website:       { status: 'pending', result: null, expanded: false, jobId: null },
      })
    }
  }

  function toggleExpanded(source) {
    setJobs(prev => ({ ...prev, [source]: { ...prev[source], expanded: !prev[source].expanded } }))
  }

  const anyComplete = Object.values(jobs).some(j => j.status === 'complete')
  const allSources = Object.keys(SOURCE_LABELS)

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
                {competitor ? competitor.company_name : 'select a competitor'}
              </span>
            </h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Select an existing competitor or add a new one, then run research.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="bb-btn-ghost"
              disabled={!competitor}
              style={{ opacity: competitor ? 1 : 0.4 }}
              onClick={() => navigate(`/analyst/${productId}/${competitor?.id}`)}>
              Analyst reports
            </button>
            <button className="bb-btn-primary"
              disabled={!competitor}
              style={{ opacity: competitor ? 1 : 0.4 }}
              onClick={() => allSources.forEach(s => { if (jobs[s].status === 'pending') handleRunJob(s) })}>
              Run all →
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 44px' }}>

        {/* Step 1 — Competitor selection */}
        <div style={{
          background: 'var(--bg-raised)',
          border: `1px solid ${competitor ? 'var(--sapphire)' : 'var(--border)'}`,
          padding: '22px 24px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="eyebrow" style={{ color: competitor ? 'var(--status-complete)' : undefined }}>
              {competitor ? '✓ Competitor selected' : 'Step 1 — Select competitor'}
            </div>
            {competitor && (
              <button className="bb-btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }}
                onClick={() => { setCompetitor(null); setJobs({ g2: { status: 'pending', result: null, expanded: false, jobId: null }, trustradius: { status: 'pending', result: null, expanded: false, jobId: null }, gartner_peers: { status: 'pending', result: null, expanded: false, jobId: null }, website: { status: 'pending', result: null, expanded: false, jobId: null } }) }}>
                Change
              </button>
            )}
          </div>

          {!competitor ? (
            <>
              {/* Existing competitor list */}
              {competitors.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {competitors.map(c => (
                    <div key={c.id}
                      onClick={() => selectCompetitor(c)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 18px', cursor: 'pointer',
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        transition: 'border-color 120ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--sapphire)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div>
                        <div style={{ fontFamily: 'Josefin Sans', fontSize: 15, fontWeight: 500 }}>
                          {c.company_name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {c.product_name}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{
                          fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                          letterSpacing: '0.14em', fontSize: 11, color: 'var(--sapphire-sky)',
                        }}>Select →</span>
                        <span
                          onClick={e => { e.stopPropagation(); setDeleteConfirm(c) }}
                          style={{
                            fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                            letterSpacing: '0.14em', fontSize: 11, color: 'var(--status-error)',
                            cursor: 'pointer',
                          }}>✕</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new */}
              {!showAddNew ? (
                <button className="bb-btn-ghost" onClick={() => setShowAddNew(true)}
                  style={{ fontSize: 12 }}>
                  ＋ Add new competitor
                </button>
              ) : (
                <form onSubmit={handleCreateCompetitor} style={{
                  padding: '18px', background: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}>
                  <div className="eyebrow" style={{ marginBottom: 14, color: 'var(--amber)' }}>
                    New competitor profile
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label className="bb-label">Company name</label>
                      <input className="bb-input" required placeholder="e.g. Salesforce"
                        value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} />
                    </div>
                    <div>
                      <label className="bb-label">Specific product</label>
                      <input className="bb-input" placeholder="e.g. Marketing Cloud"
                        value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                    </div>
                  </div>
                  {createError && (
                    <div style={{
                      fontSize: 13, color: 'var(--status-error)', marginBottom: 12,
                      padding: '8px 12px', border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)',
                    }}>{createError}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="bb-btn-primary" type="submit" disabled={creating}>
                      {creating ? 'Creating…' : 'Create profile →'}
                    </button>
                    <button className="bb-btn-ghost" type="button"
                      onClick={() => { setShowAddNew(false); setCreateError(null) }}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            // Selected competitor summary
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <div>
                <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 4 }}>Company</div>
                <div style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: 500 }}>{competitor.company_name}</div>
              </div>
              <div>
                <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 4 }}>Product</div>
                <div style={{ fontFamily: 'Josefin Sans', fontSize: 16, fontWeight: 500 }}>{competitor.product_name}</div>
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

        {/* Step 2 — Taxonomy */}
        {competitor && (
          <div style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            padding: '22px 24px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="eyebrow" style={{ color: taxonomyConfirmed ? 'var(--status-complete)' : undefined }}>
                {taxonomyConfirmed ? '✓ Taxonomy confirmed' : 'Step 2 — Taxonomy resolver (optional)'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {taxonomyMessages.length > 0 && !taxonomyConfirmed && (
                  <button className="bb-btn-primary" style={{ padding: '6px 14px', fontSize: 11 }}
                    onClick={() => setTaxonomyConfirmed(true)}>
                    Confirm ✓
                  </button>
                )}
                {!taxonomyConfirmed && (
                  <button className="bb-btn-ghost" disabled={taxonomyLoading}
                    onClick={handleResolveTaxonomy}>
                    {taxonomyLoading && !taxonomyMessages.length ? 'Resolving…' : taxonomyMessages.length ? 'Re-resolve' : 'Resolve taxonomy'}
                  </button>
                )}
                {!taxonomyConfirmed && anyComplete && (
                  <button className="bb-btn-ghost" style={{ fontSize: 11 }}
                    onClick={() => setTaxonomyConfirmed(true)}>
                    Skip
                  </button>
                )}
              </div>
            </div>

            {taxonomyMessages.length > 0 && !taxonomyConfirmed && (
              <div style={{ marginTop: 14 }}>
                {taxonomyMessages.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 10,
                  }}>
                    <div style={{
                      maxWidth: '90%', padding: '12px 16px',
                      background: msg.role === 'user' ? 'rgba(45,125,210,0.10)' : 'var(--bg)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(45,125,210,0.35)' : 'var(--border)'}`,
                      fontSize: 13, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap',
                    }}>
                      <div className="eyebrow" style={{
                        fontSize: 9.5, marginBottom: 6,
                        color: msg.role === 'user' ? 'var(--sapphire-sky)' : 'var(--amber)',
                      }}>
                        {msg.role === 'user' ? '— You' : '— BattleBot'}
                      </div>
                      {msg.content}
                    </div>
                  </div>
                ))}
                <form onSubmit={handleTaxonomyReply} style={{
                  display: 'flex', gap: 10, marginTop: 10, alignItems: 'center',
                  background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '10px 12px',
                }}>
                  <span style={{ color: 'var(--amber)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>›</span>
                  <input className="bb-input"
                    style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 13 }}
                    placeholder="Reply to confirm scope…"
                    value={taxonomyInput} onChange={e => setTaxonomyInput(e.target.value)}
                    disabled={taxonomyLoading} />
                  <button className="bb-btn-ghost" type="submit"
                    disabled={taxonomyLoading || !taxonomyInput.trim()}
                    style={{ padding: '6px 14px', whiteSpace: 'nowrap' }}>
                    {taxonomyLoading ? '…' : 'Send'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Research jobs */}
        {competitor && (
          <>
            <div className="eyebrow" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
              <span>Step 3 — Web research</span>
              <span style={{ color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', letterSpacing: 0 }}>
                {Object.values(jobs).filter(j => j.status === 'complete').length} / 4 complete
              </span>
            </div>

            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', marginBottom: 24 }}>
              {Object.entries(SOURCE_LABELS).map(([source, { label }]) => {
                const job = jobs[source]
                return (
                  <div key={source} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '200px 140px 1fr 120px',
                      alignItems: 'center', gap: 20, padding: '18px 22px',
                    }}>
                      <div>
                        <div style={{ fontFamily: 'Josefin Sans', fontSize: 14, fontWeight: 500 }}>{label}</div>
                        <div className="eyebrow" style={{ color: 'var(--text-dim)', marginTop: 2, fontSize: 9.5 }}>
                          research_results
                        </div>
                      </div>
                      <StatusBadge status={job.status} />
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {job.status === 'running'  && 'Running — polling for results…'}
                        {job.status === 'complete' && 'Complete — results loaded'}
                        {job.status === 'error'    && 'Error — try running again'}
                        {job.status === 'pending'  && 'Ready to run'}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {job.status === 'complete' ? (
                          <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <span onClick={() => toggleExpanded(source)} style={{
                              fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                              letterSpacing: '0.14em', fontSize: 11,
                              color: 'var(--sapphire-sky)', cursor: 'pointer',
                            }}>
                              {job.expanded ? 'Hide ↑' : 'View →'}
                            </span>
                            <span onClick={() => handleDeleteResearch(source)} style={{
                              fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                              letterSpacing: '0.14em', fontSize: 11,
                              color: 'var(--status-error)', cursor: 'pointer',
                            }}>✕</span>
                          </div>
                        ) : job.status === 'running' ? (
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
                            polling…
                          </span>
                        ) : (
                          <button className="bb-btn-ghost" style={{ padding: '7px 14px', fontSize: 10.5 }}
                            onClick={() => handleRunJob(source)}>
                            Run
                          </button>
                        )}
                      </div>
                    </div>
                    {job.expanded && job.result && (
                      <div style={{
                        padding: '16px 22px 20px', fontSize: 13,
                        color: 'var(--text-muted)', lineHeight: 1.7,
                        whiteSpace: 'pre-wrap', borderTop: '1px solid var(--divider)',
                      }}>
                        {job.result}
                      </div>
                    )}
                  </div>
                )
              })}
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
                    ? 'Research available. Proceed to FUD analysis or add analyst reports.'
                    : 'Run at least one research job to unlock FUD analysis.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="bb-btn-ghost"
                  onClick={() => navigate(`/analyst/${productId}/${competitor.id}`)}>
                  Analyst reports
                </button>
                <button className="bb-btn-amber"
                  disabled={!anyComplete}
                  style={{ opacity: anyComplete ? 1 : 0.4 }}
                  onClick={() => navigate(`/fud/${productId}/${competitor.id}`)}>
                  FUD analysis →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>

      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(8,10,18,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 420, background: 'var(--bg-raised)',
            border: '1px solid var(--border)', padding: '32px 36px',
          }}>
            <div className="eyebrow" style={{ color: 'var(--status-error)', marginBottom: 12 }}>
              — Confirm delete
            </div>
            <div style={{ fontFamily: 'Josefin Sans', fontSize: 18, fontWeight: 500, marginBottom: 12 }}>
              Delete {deleteConfirm.company_name}?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              This will permanently delete the competitor profile and all associated research results. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="bb-btn-ghost"
                style={{ flex: 1, padding: 12, fontSize: 12, borderColor: 'var(--status-error)', color: 'var(--status-error)' }}
                onClick={() => handleDeleteCompetitor(deleteConfirm)}>
                Delete permanently
              </button>
              <button className="bb-btn-ghost"
                style={{ flex: 1, padding: 12, fontSize: 12 }}
                onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}