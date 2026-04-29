import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'
import HarveyBall from '../../components/HarveyBall.jsx'

export default function Viewer() {
  const { battlecardId } = useParams()
  const navigate = useNavigate()
  const [battlecard, setBattlecard] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('battlecards')
        .select('*, battlecard_versions(*)')
        .eq('id', battlecardId)
        .single()
      if (error) { setError(error.message); setLoading(false); return }
      setBattlecard(data)
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

  if (error || !battlecard) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Battlecards" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--status-error)', fontSize: 13 }}>
        {error || 'Battlecard not found.'}
      </div>
    </div>
  )

  const version = battlecard.battlecard_versions?.[0]
  const tabUseCase = version?.tab_use_case || {}
  const tabIntel = version?.tab_critical_intelligence || {}
  const tabFud = version?.tab_fud || {}

  const tabs = [
    '01 — Use cases',
    '02 — Critical intelligence',
    '03 — FUD responses',
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Battlecards" breadcrumb={
        <><span style={{ color: 'var(--sapphire-sky)' }}>{battlecard.product_name}</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span style={{ color: 'var(--amber-gold)' }}>vs {battlecard.competitor_name}</span></>
      } />

      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(45,125,210,0.08) 0%, transparent 100%)',
        borderBottom: '1px solid var(--divider)',
        padding: '32px 44px 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 10 }}>
              — Battlecard · {version ? 'v.' + (battlecard.battlecard_versions?.length || 1) : 'draft'}
            </div>
            <h1 className="h-display" style={{ margin: 0, fontSize: 38, fontWeight: 300 }}>
              <span style={{ color: 'var(--sapphire-sky)' }}>{battlecard.product_name}</span>
              <span style={{ color: 'var(--text-dim)', margin: '0 18px', fontWeight: 200 }}>vs.</span>
              <span style={{ color: 'var(--amber-gold)' }}>{battlecard.competitor_name}</span>
            </h1>
            <div style={{ marginTop: 12, display: 'flex', gap: 22, fontSize: 12.5, color: 'var(--text-muted)' }}>
              <span>
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginRight: 6 }}>
                  Last updated
                </span>
                {new Date(battlecard.updated_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </span>
              <span>
                <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginRight: 6 }}>
                  Status
                </span>
                <span style={{ color: battlecard.status === 'published' ? 'var(--status-complete)' : 'var(--amber)' }}>
                  {battlecard.status}
                </span>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="bb-btn-ghost" onClick={() => window.print()}>Print</button>
            <button className="bb-btn-primary"
              onClick={() => navigate(`/assembly/${battlecard.product_id}/${encodeURIComponent(battlecard.competitor_name)}`)}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
            <div>
              <h2 className="h-display" style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 300 }}>
                Where each platform actually wins
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 22px' }}>
                Harvey balls reflect aggregate review data, analyst scores, and field input.
              </p>

              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.6fr 80px 80px 1.4fr',
                  gap: 16, padding: '14px 22px', borderBottom: '1px solid var(--border)',
                  fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                  letterSpacing: '0.16em', fontSize: 10.5, color: 'var(--text-dim)',
                }}>
                  <span>Use case</span>
                  <span style={{ textAlign: 'center', color: 'var(--sapphire-sky)' }}>
                    {battlecard.product_name}
                  </span>
                  <span style={{ textAlign: 'center', color: 'var(--amber-gold)' }}>
                    {battlecard.competitor_name}
                  </span>
                  <span>Why</span>
                </div>
                {(tabUseCase.use_cases || []).map((uc, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1.6fr 80px 80px 1.4fr',
                    gap: 16, padding: '16px 22px', alignItems: 'center',
                    borderBottom: '1px solid var(--divider)',
                  }}>
                    <span style={{
                      fontSize: 14, fontFamily: 'Josefin Sans',
                      fontWeight: 500, letterSpacing: '0.01em',
                    }}>{uc.use_case || uc.name}</span>
                    <span style={{ textAlign: 'center' }}>
                      <HarveyBall value={uc.score || uc.your_score || 0} size={22} color="#5FA8E8" />
                    </span>
                    <span style={{ textAlign: 'center' }}>
                      <HarveyBall value={uc.competitor_score || 0} size={22} color="#F2C46D" />
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                      {uc.rationale}
                    </span>
                  </div>
                ))}
                {(!tabUseCase.use_cases || tabUseCase.use_cases.length === 0) && (
                  <div style={{ padding: '24px 22px', color: 'var(--text-dim)', fontSize: 13 }}>
                    No use case data available.
                  </div>
                )}
              </div>
            </div>

            {/* Competitor sidebar */}
            <CompetitorSidebar battlecard={battlecard} tabIntel={tabIntel} />
          </div>
        )}

        {/* Tab 2 — Critical intelligence */}
        {activeTab === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
            <div>
              <h2 className="h-display" style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 300 }}>
                SWOT — from {battlecard.competitor_name}'s vantage
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { key: 'strengths',     label: 'Strengths',     color: '#86EFAC', bg: 'rgba(74,222,128,0.04)' },
                  { key: 'weaknesses',    label: 'Weaknesses',    color: '#FCA5A5', bg: 'rgba(239,68,68,0.04)' },
                  { key: 'opportunities', label: 'Opportunities', color: '#5FA8E8', bg: 'rgba(45,125,210,0.04)' },
                  { key: 'threats',       label: 'Threats',       color: '#F2C46D', bg: 'rgba(232,160,32,0.04)' },
                ].map(({ key, label, color, bg }) => (
                  <div key={key} style={{ background: bg, border: `1px solid ${color}33`, padding: '16px 18px' }}>
                    <div className="eyebrow" style={{ color, marginBottom: 10 }}>{label}</div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {(tabIntel.swot?.[key] || []).map((item, i) => (
                        <li key={i} style={{
                          fontSize: 13, lineHeight: 1.55, paddingLeft: 14,
                          position: 'relative', marginBottom: 6, color: 'var(--text)',
                        }}>
                          <span style={{
                            position: 'absolute', left: 0, top: 8,
                            width: 4, height: 4, background: color,
                          }} />
                          {item}
                        </li>
                      ))}
                      {(!tabIntel.swot?.[key] || tabIntel.swot[key].length === 0) && (
                        <li style={{ fontSize: 13, color: 'var(--text-dim)' }}>No data.</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Customer review themes */}
              {tabIntel.review_themes && (
                <>
                  <h3 className="font-display" style={{
                    marginTop: 28, marginBottom: 12, fontSize: 13,
                    textTransform: 'uppercase', letterSpacing: '0.18em',
                    color: 'var(--text-muted)', fontWeight: 500,
                  }}>Customer review themes</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {typeof tabIntel.review_themes === 'string'
                      ? tabIntel.review_themes
                      : JSON.stringify(tabIntel.review_themes, null, 2)}
                  </div>
                </>
              )}
            </div>
            <CompetitorSidebar battlecard={battlecard} tabIntel={tabIntel} />
          </div>
        )}

        {/* Tab 3 — FUD responses */}
        {activeTab === 2 && (
          <div>
            <h2 className="h-display" style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 300 }}>
              FUD responses &amp; proof points
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' }}>
              Approved FUD candidates with proof points for field use.
            </p>
            {(tabFud.items || tabFud.candidates || []).map((item, i) => (
              <div key={i} style={{
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                padding: '20px 24px', marginBottom: 14,
              }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', fontSize: 12, paddingTop: 2 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'Josefin Sans', fontSize: 15,
                      fontWeight: 500, letterSpacing: '0.02em', marginBottom: 6,
                    }}>
                      {item.headline || item.fud_headline}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                      {item.threat_description || item.description}
                    </div>
                    {(item.proof_point) && (
                      <div style={{
                        padding: '12px 16px',
                        background: 'rgba(45,125,210,0.06)',
                        border: '1px solid rgba(45,125,210,0.2)',
                      }}>
                        <div className="eyebrow" style={{ color: 'var(--sapphire-sky)', marginBottom: 6 }}>
                          Proof point
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                          {item.proof_point}
                        </div>
                      </div>
                    )}
                    {item.source_attribution && (
                      <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
                        {item.source_attribution}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(!tabFud.items && !tabFud.candidates) && (
              <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No FUD data available.</div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function CompetitorSidebar({ battlecard, tabIntel }) {
  return (
    <div>
      <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', padding: '22px' }}>
        <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 8 }}>Competitor</div>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '0.02em' }}>
          {battlecard.competitor_name}
        </div>
        {tabIntel.analyst_positions && (
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {Object.entries(tabIntel.analyst_positions).map(([key, val]) => (
              <div key={key}>
                <div className="eyebrow" style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>{key}</div>
                <div style={{
                  fontFamily: 'Josefin Sans', fontWeight: 300,
                  fontSize: 13, marginTop: 2, color: 'var(--text)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{val}</div>
              </div>
            ))}
          </div>
        )}
        {tabIntel.competitor_positioning && (
          <div style={{ borderTop: '1px solid var(--divider)', marginTop: 18, paddingTop: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Their positioning</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "{tabIntel.competitor_positioning}"
            </div>
          </div>
        )}
      </div>
    </div>
  )
}