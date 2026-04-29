import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'
import HarveyBall from '../../components/HarveyBall.jsx'

export default function Viewer() {
  const { battlecardId } = useParams()
  const navigate = useNavigate()
  const [battlecard, setBattlecard] = useState(null)
  const [version, setVersion] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: card, error: cardError } = await supabase
        .from('battlecards')
        .select('*')
        .eq('id', battlecardId)
        .single()
      if (cardError) { setError(cardError.message); setLoading(false); return }
      setBattlecard(card)

      const { data: ver, error: verError } = await supabase
        .from('battlecard_versions')
        .select('*')
        .eq('battlecard_id', battlecardId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()
      if (verError) { setError(verError.message); setLoading(false); return }
      setVersion(ver)
      setLoading(false)
    }
    load()
  }, [battlecardId])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Battlecards" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
        Loading battlecard…
      </div>
    </div>
  )

  if (error || !battlecard || !version) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Battlecards" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--status-error)', fontSize: 13 }}>
        {error || 'Battlecard not found.'}
      </div>
    </div>
  )

  const header = version.tab_critical_intelligence?.header || {}
  const useCases = version.tab_use_case || []
  const swot = version.tab_critical_intelligence?.swot || {}
  const analyst = version.tab_critical_intelligence?.analyst || {}
  const customer = version.tab_critical_intelligence?.customer || {}
  const fudSections = version.tab_fud || []
  const productName = header.our_product_name || battlecard.product_name || '…'
  const competitorName = header.competitor_name || battlecard.competitor_name || '…'

  const tabs = ['01 — Use cases', '02 — Critical intelligence', '03 — FUD responses']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Battlecards" breadcrumb={
        <><span style={{ color: 'var(--sapphire-sky)' }}>{productName}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span style={{ color: 'var(--amber-gold)' }}>vs {competitorName}</span></>
      } />

      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(45,125,210,0.08) 0%, transparent 100%)',
        borderBottom: '1px solid var(--divider)', padding: '32px 44px 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 10 }}>
              — Battlecard · v.{version.version_number}
            </div>
            <h1 className="h-display" style={{ margin: 0, fontSize: 38, fontWeight: 300 }}>
              <span style={{ color: 'var(--sapphire-sky)' }}>{productName}</span>
              <span style={{ color: 'var(--text-dim)', margin: '0 18px', fontWeight: 200 }}>vs.</span>
              <span style={{ color: 'var(--amber-gold)' }}>{competitorName}</span>
            </h1>
            <div style={{ marginTop: 12, display: 'flex', gap: 22, fontSize: 12.5, color: 'var(--text-muted)' }}>
              <span>
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginRight: 6 }}>Published</span>
                {header.publish_date || new Date(version.changed_at).toLocaleDateString()}
              </span>
              <span>
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginRight: 6 }}>Status</span>
                <span style={{ color: 'var(--status-complete)' }}>{battlecard.status}</span>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="bb-btn-ghost" onClick={() => window.print()}>Print</button>
            <button className="bb-btn-primary"
              onClick={() => navigate(`/assembly/${battlecard.product_id}/${battlecard.competitor_id}`)}>
              Re-assemble
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {tabs.map((tab, i) => (
            <div key={i} onClick={() => setActiveTab(i)} style={{
              padding: '14px 26px', cursor: 'pointer',
              borderBottom: activeTab === i ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === i ? 'var(--text)' : 'var(--text-muted)',
              fontFamily: 'Josefin Sans', textTransform: 'uppercase',
              letterSpacing: '0.16em', fontSize: 12, fontWeight: 500,
            }}>{tab}</div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 44px 36px' }}>

        {/* Tab 1 — Use cases */}
        {activeTab === 0 && (
          <div>
            <h2 className="h-display" style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 300 }}>
              Where each platform wins
            </h2>
            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', marginBottom: 28 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1.6fr 80px 80px 1.4fr',
                gap: 16, padding: '14px 22px', borderBottom: '1px solid var(--border)',
                fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                letterSpacing: '0.16em', fontSize: 10.5, color: 'var(--text-dim)',
              }}>
                <span>Use case</span>
                <span style={{ textAlign: 'center', color: 'var(--sapphire-sky)' }}>{productName}</span>
                <span style={{ textAlign: 'center', color: 'var(--amber-gold)' }}>{competitorName}</span>
                <span>Rationale</span>
              </div>
              {useCases.map((uc, i) => (
                <div key={i} style={{
                  borderBottom: '1px solid var(--divider)',
                }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.6fr 80px 80px 1.4fr',
                    gap: 16, padding: '16px 22px', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontFamily: 'Josefin Sans', fontWeight: 500, letterSpacing: '0.01em' }}>
                        {uc.uc_name}
                      </div>
                      {uc.uc_persona && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'JetBrains Mono' }}>
                          {uc.uc_persona}
                        </div>
                      )}
                    </div>
                    <span style={{ textAlign: 'center' }}>
                      <HarveyBall value={uc.uc_our_score || 0} size={22} color="#5FA8E8" />
                    </span>
                    <span style={{ textAlign: 'center' }}>
                      <HarveyBall value={uc.uc_their_score || 0} size={22} color="#F2C46D" />
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                      {uc.uc_rationale}
                    </span>
                  </div>
                  {/* Subcomponents */}
                  {uc.subcomponents && uc.subcomponents.length > 0 && (
                    <div style={{ padding: '0 22px 16px', borderTop: '1px solid var(--divider)' }}>
                      {uc.subcomponents.map((sub, j) => (
                        <div key={j} style={{
                          display: 'grid', gridTemplateColumns: '1.6fr 80px 80px 1.4fr',
                          gap: 16, padding: '10px 0', alignItems: 'center',
                          borderBottom: j < uc.subcomponents.length - 1 ? '1px solid rgba(75,101,132,0.15)' : 'none',
                        }}>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16 }}>
                            ↳ {sub.sub_name}
                          </div>
                          <span style={{ textAlign: 'center' }}>
                            <HarveyBall value={sub.our_score || 0} size={16} color="#5FA8E8" />
                          </span>
                          <span style={{ textAlign: 'center' }}>
                            <HarveyBall value={sub.their_score || 0} size={16} color="#F2C46D" />
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                            {sub.rationale}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {useCases.length === 0 && (
                <div style={{ padding: '24px 22px', color: 'var(--text-dim)', fontSize: 13 }}>
                  No use case data available.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2 — Critical intelligence */}
        {activeTab === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32 }}>
            <div>
              {/* SWOT */}
              <h2 className="h-display" style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 300 }}>
                SWOT — from {competitorName}'s vantage
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
                {[
                  { key: 'strengths',     label: 'Strengths',     color: '#86EFAC', bg: 'rgba(74,222,128,0.04)' },
                  { key: 'weaknesses',    label: 'Weaknesses',    color: '#FCA5A5', bg: 'rgba(239,68,68,0.04)' },
                  { key: 'opportunities', label: 'Opportunities', color: '#5FA8E8', bg: 'rgba(45,125,210,0.04)' },
                  { key: 'threats',       label: 'Threats',       color: '#F2C46D', bg: 'rgba(232,160,32,0.04)' },
                ].map(({ key, label, color, bg }) => (
                  <div key={key} style={{ background: bg, border: `1px solid ${color}33`, padding: '16px 18px' }}>
                    <div className="eyebrow" style={{ color, marginBottom: 10 }}>{label}</div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {(swot[key] || []).map((item, i) => (
                        <li key={i} style={{
                          fontSize: 13, lineHeight: 1.55, paddingLeft: 14,
                          position: 'relative', marginBottom: 8, color: 'var(--text)',
                        }}>
                          <span style={{ position: 'absolute', left: 0, top: 8, width: 4, height: 4, background: color }} />
                          {item}
                        </li>
                      ))}
                      {(!swot[key] || swot[key].length === 0) && (
                        <li style={{ fontSize: 13, color: 'var(--text-dim)' }}>No data.</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Analyst positions */}
              {analyst.placements && analyst.placements.length > 0 && (
                <>
                  <h3 className="font-display" style={{
                    marginBottom: 12, fontSize: 13, textTransform: 'uppercase',
                    letterSpacing: '0.18em', color: 'var(--text-muted)', fontWeight: 500,
                  }}>Analyst positions</h3>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                    {analyst.placements.map((p, i) => (
                      <div key={i} style={{
                        padding: '12px 18px', background: 'var(--bg-raised)',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontSize: 15, fontFamily: 'Josefin Sans', fontWeight: 500 }}>{p.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'JetBrains Mono' }}>{p.source}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sidebar */}
            <div>
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', padding: '22px', marginBottom: 16 }}>
                <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>Competitor</div>
                <div className="font-display" style={{ fontSize: 22, fontWeight: 500 }}>{competitorName}</div>
                {customer.ratings && customer.ratings.length > 0 && (
                  <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {customer.ratings.map((r, i) => (
                      <div key={i}>
                        <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>{r.label}</div>
                        <div style={{ fontFamily: 'Josefin Sans', fontSize: 22, fontWeight: 300, marginTop: 2 }}>{r.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                {analyst.strengths && analyst.strengths.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--divider)', marginTop: 16, paddingTop: 14 }}>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Analyst strengths</div>
                    {analyst.strengths.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>· {s}</div>
                    ))}
                  </div>
                )}
                {analyst.cautions && analyst.cautions.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--divider)', marginTop: 14, paddingTop: 14 }}>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Analyst cautions</div>
                    {analyst.cautions.map((c, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>· {c}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3 — FUD responses */}
        {activeTab === 2 && (
          <div>
            <h2 className="h-display" style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 300 }}>
              FUD responses &amp; proof points
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' }}>
              Approved FUD candidates with discovery questions and proof points for field use.
            </p>
            {fudSections.map((section, si) => (
              <div key={si} style={{ marginBottom: 28 }}>
                <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 14 }}>{section.title}</div>
                {(section.items || []).map((item, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    padding: '20px 24px', marginBottom: 14,
                  }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', fontSize: 12, paddingTop: 2 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                          {item.intelligence}
                        </div>
                        {item.discovery_question && (
                          <div style={{
                            padding: '10px 14px', marginBottom: 10,
                            background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)',
                          }}>
                            <div className="eyebrow" style={{ color: 'var(--amethyst-lavender)', marginBottom: 4 }}>Discovery question</div>
                            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>
                              {item.discovery_question}
                            </div>
                          </div>
                        )}
                        {item.recommended_response && (
                          <div style={{
                            padding: '10px 14px',
                            background: 'rgba(45,125,210,0.06)', border: '1px solid rgba(45,125,210,0.2)',
                          }}>
                            <div className="eyebrow" style={{ color: 'var(--sapphire-sky)', marginBottom: 4 }}>Proof point</div>
                            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                              {item.recommended_response}
                            </div>
                          </div>
                        )}
                        {item.intel_sources && item.intel_sources.length > 0 && (
                          <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
                            {item.intel_sources.map(s => s.label).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {fudSections.length === 0 && (
              <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No FUD data available.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}