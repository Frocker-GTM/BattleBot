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
          <div>
            {/* Product Overview */}
            <div style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              marginBottom: 18,
            }}>
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h3 style={{
                  fontFamily: 'Josefin Sans', fontSize: 12, textTransform: 'uppercase',
                  letterSpacing: '0.2em', color: 'var(--text-muted)', fontWeight: 600, margin: 0,
                }}>Product Overview</h3>
                <div style={{ height: 2, width: 32, background: 'var(--amethyst)' }} />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {(version.tab_critical_intelligence?.overview || []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                      <th style={{
                        width: 200, padding: '14px 20px', textAlign: 'left', verticalAlign: 'top',
                        fontFamily: 'Josefin Sans', fontSize: 11, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.15em',
                        color: 'var(--amethyst-lavender)', background: 'var(--bg-elevated)',
                      }}>{row.label}</th>
                      <td style={{ padding: '14px 20px', fontSize: 14, color: 'var(--text)', verticalAlign: 'top' }}>
                        {row.value}
                        {row.sources && row.sources.length > 0 && (
                          <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-dim)' }}>
                            {row.sources.map((s, j) => (
                              <span key={j}>
                                {j > 0 && <span style={{ margin: '0 6px', color: 'var(--border-strong)' }}>·</span>}
                                <span style={{ color: 'var(--sapphire-sky)' }}>{s.label}</span>
                              </span>
                            ))}
                            {row.accessed && <span style={{ marginLeft: 8 }}>· Accessed {row.accessed}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Analyst & Customer Perspectives */}
            <div style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              marginBottom: 18,
            }}>
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h3 style={{
                  fontFamily: 'Josefin Sans', fontSize: 12, textTransform: 'uppercase',
                  letterSpacing: '0.2em', color: 'var(--text-muted)', fontWeight: 600, margin: 0,
                }}>Analyst &amp; Customer Perspectives</h3>
                <div style={{ height: 2, width: 32, background: 'var(--amethyst)' }} />
              </div>
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                {/* Analyst */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 20 }}>
                  <h4 style={{
                    fontFamily: 'Josefin Sans', fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: '0.2em', color: 'var(--amethyst-lavender)', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    Overall Analyst Perspective
                  </h4>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                    {(analyst.placements || []).map((p, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        <strong style={{
                          color: 'var(--text)', fontFamily: 'Josefin Sans', fontWeight: 600,
                          letterSpacing: 0, textTransform: 'none', fontSize: 13, display: 'block',
                        }}>{p.label}</strong>
                        {p.source}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <h5 style={{
                        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em',
                        color: 'var(--sapphire-sky)', margin: '0 0 6px',
                        fontFamily: 'Josefin Sans', fontWeight: 600,
                      }}>Strengths cited</h5>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                        {(analyst.strengths || []).map((s, i) => (
                          <li key={i} style={{ marginBottom: 4, color: 'var(--text)' }}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 style={{
                        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em',
                        color: 'var(--amber-gold)', margin: '0 0 6px',
                        fontFamily: 'Josefin Sans', fontWeight: 600,
                      }}>Cautions cited</h5>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                        {(analyst.cautions || []).map((c, i) => (
                          <li key={i} style={{ marginBottom: 4, color: 'var(--text)' }}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Customer */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 20 }}>
                  <h4 style={{
                    fontFamily: 'Josefin Sans', fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: '0.2em', color: 'var(--amethyst-lavender)', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    Overall Customer Perspective
                  </h4>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                    {(customer.ratings || []).map((r, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        <strong style={{
                          color: 'var(--text)', fontFamily: 'Josefin Sans', fontWeight: 600,
                          letterSpacing: 0, textTransform: 'none', fontSize: 13, display: 'block',
                        }}>{r.value}</strong>
                        {r.label}{r.n ? ` · n=${r.n}` : ''}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <h5 style={{
                        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em',
                        color: 'var(--sapphire-sky)', margin: '0 0 6px',
                        fontFamily: 'Josefin Sans', fontWeight: 600,
                      }}>Praise themes</h5>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                        {(customer.praise || []).filter(p => !p.includes('See research results')).slice(0, 5).map((p, i) => (
                          <li key={i} style={{ marginBottom: 4, color: 'var(--text)' }}>{p}</li>
                        ))}
                        {(customer.praise || []).every(p => p.includes('See research results')) && (
                          <li style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>See research results</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h5 style={{
                        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em',
                        color: 'var(--amber-gold)', margin: '0 0 6px',
                        fontFamily: 'Josefin Sans', fontWeight: 600,
                      }}>Complaint themes</h5>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                        {(customer.complaints || []).filter(c => !c.includes('See research results')).slice(0, 5).map((c, i) => (
                          <li key={i} style={{ marginBottom: 4, color: 'var(--text)' }}>{c}</li>
                        ))}
                        {(customer.complaints || []).every(c => c.includes('See research results')) && (
                          <li style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>See research results</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SWOT */}
            <div style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              marginBottom: 18,
            }}>
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <h3 style={{
                  fontFamily: 'Josefin Sans', fontSize: 12, textTransform: 'uppercase',
                  letterSpacing: '0.2em', color: 'var(--text-muted)', fontWeight: 600, margin: 0,
                }}>SWOT Summary</h3>
                <div style={{ height: 2, width: 32, background: 'var(--amethyst)' }} />
              </div>
              <div style={{ padding: 2 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'var(--divider)' }}>
                  {[
                    { key: 'strengths',     label: 'Strengths',     color: 'var(--sapphire-sky)',      border: 'var(--sapphire)' },
                    { key: 'weaknesses',    label: 'Weaknesses',    color: 'var(--amber-gold)',         border: 'var(--amber)' },
                    { key: 'opportunities', label: 'Opportunities', color: 'var(--amethyst-lavender)',  border: 'var(--amethyst)' },
                    { key: 'threats',       label: 'Threats',       color: '#B8D9F7',                   border: 'var(--slate)' },
                  ].map(({ key, label, color, border }) => (
                    <div key={key} style={{
                      background: 'var(--bg-raised)', padding: 20, minHeight: 160,
                      borderLeft: `2px solid ${border}`,
                    }}>
                      <h4 style={{
                        fontFamily: 'Josefin Sans', fontSize: 11, textTransform: 'uppercase',
                        letterSpacing: '0.22em', color, marginBottom: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        {label}
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: 16, listStyleType: 'disc' }}>
                        {(swot[key] || []).map((item, i) => (
                          <li key={i} style={{ marginBottom: 8, fontSize: 13, color: 'var(--text)', paddingLeft: 4 }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3 — FUD responses */}
        {activeTab === 2 && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              marginBottom: 22, paddingBottom: 14, borderBottom: '1px solid var(--divider)',
            }}>
              <h2 className="h-display" style={{ margin: 0, fontSize: 20, fontWeight: 300 }}>
                FUD — Discovery &amp; Response
              </h2>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
                Scope opportunity · Don't attack · Prioritized by strengths
              </span>
            </div>

            {fudSections.map((section, si) => (
              <div key={si} style={{ marginBottom: 28 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--divider)',
                }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--amber)', letterSpacing: '0.1em' }}>
                    {String(si + 1).padStart(2, '0')}
                  </span>
                  <h3 style={{
                    fontFamily: 'Josefin Sans', fontSize: 14, textTransform: 'uppercase',
                    letterSpacing: '0.15em', color: 'var(--text)', fontWeight: 500, margin: 0,
                  }}>{section.title}</h3>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                    {(section.items || []).length} items
                  </span>
                </div>

                {(section.items || []).map((item, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 2, background: 'var(--divider)',
                    border: '1px solid var(--border)', marginBottom: 12,
                    overflow: 'hidden',
                  }}>
                    {/* Intelligence */}
                    <div style={{ background: 'var(--bg-raised)', padding: '18px 20px', minHeight: 140 }}>
                      <div style={{
                        fontFamily: 'Josefin Sans', fontSize: 10, letterSpacing: '0.22em',
                        textTransform: 'uppercase', fontWeight: 600, marginBottom: 10,
                        display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber)',
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                        Intelligence
                        <span style={{
                          fontFamily: 'JetBrains Mono', fontSize: 9, padding: '2px 6px',
                          background: item.priority === 'high' ? 'rgba(232,160,32,0.15)' : 'rgba(139,92,246,0.15)',
                          color: item.priority === 'high' ? 'var(--amber-gold)' : 'var(--amethyst-lavender)',
                          letterSpacing: '0.08em', textTransform: 'uppercase', marginLeft: 'auto',
                        }}>{item.priority_label}</span>
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                        {item.intelligence}
                      </p>
                      {item.intel_sources && item.intel_sources.length > 0 && (
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-dim)' }}>
                          {item.intel_sources.map(s => s.label).join(' · ')}
                        </div>
                      )}
                    </div>

                    {/* Discovery Question */}
                    <div style={{ background: 'var(--bg-raised)', padding: '18px 20px', minHeight: 140 }}>
                      <div style={{
                        fontFamily: 'Josefin Sans', fontSize: 10, letterSpacing: '0.22em',
                        textTransform: 'uppercase', fontWeight: 600, marginBottom: 10,
                        display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sapphire-sky)',
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                        Discovery Question
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, fontStyle: 'normal' }}>
                        <span style={{ color: 'var(--sapphire-sky)', fontSize: 16, marginRight: 2 }}>"</span>
                        {item.discovery_question}
                        <span style={{ color: 'var(--sapphire-sky)', fontSize: 16, marginLeft: 2 }}>"</span>
                      </p>
                    </div>

                    {/* Recommended Response */}
                    <div style={{ background: 'var(--bg-raised)', padding: '18px 20px', minHeight: 140 }}>
                      <div style={{
                        fontFamily: 'Josefin Sans', fontSize: 10, letterSpacing: '0.22em',
                        textTransform: 'uppercase', fontWeight: 600, marginBottom: 10,
                        display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amethyst-lavender)',
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                        Recommended Response
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                        <span style={{ color: 'var(--amethyst-lavender)', fontSize: 16, marginRight: 2 }}>"</span>
                        {item.recommended_response}
                        <span style={{ color: 'var(--amethyst-lavender)', fontSize: 16, marginLeft: 2 }}>"</span>
                      </p>
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