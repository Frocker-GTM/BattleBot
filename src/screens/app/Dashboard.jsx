import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TopNav from '../../components/TopNav.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [battlecards, setBattlecards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prods }, { data: cards }] = await Promise.all([
        supabase.from('user_products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('battlecards').select('*').order('updated_at', { ascending: false }),
      ])
      setProducts(prods || [])
      setBattlecards(cards || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <TopNav active="Dashboard" />

      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '36px 44px 28px', borderBottom: '1px solid var(--divider)',
      }}>
        <div>
          <div className="eyebrow" style={{ color: 'var(--amber)', marginBottom: 10 }}>— Workspace</div>
          <h1 className="h-display" style={{ margin: 0, fontSize: 36, fontWeight: 300 }}>Your Battlecards</h1>
          <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            {loading ? 'Loading…' : `${products.length} product${products.length !== 1 ? 's' : ''} · ${battlecards.length} battlecard${battlecards.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="bb-btn-amber" onClick={() => navigate('/warmup')}>＋ New product</button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr', overflow: 'hidden' }}>

        {/* Products rail */}
        <div style={{ borderRight: '1px solid var(--divider)', padding: '24px', overflow: 'auto' }}>
          <div className="eyebrow" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
            <span>Your products</span>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', letterSpacing: 0 }}>{products.length}</span>
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
          ) : products.length === 0 ? (
            <div style={{ padding: '28px 20px', border: '1px dashed var(--border-strong)', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
                No products yet. Run the warmup to create your first product profile.
              </div>
              <button className="bb-btn-primary" onClick={() => navigate('/warmup')}>Start warmup →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {products.map(p => (
                <div key={p.id} onClick={() => navigate(`/research/${p.id}`)} style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  padding: '20px 22px', cursor: 'pointer',
                }}>
                  <div className="eyebrow" style={{ color: 'var(--text-dim)', marginBottom: 8 }}>{p.category}</div>
                  <div className="font-display" style={{ fontSize: 20, fontWeight: 500, letterSpacing: '0.02em' }}>
                    {p.product_name}
                  </div>
                  <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                    {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{
            marginTop: 28, padding: '18px', border: '1px dashed var(--border-strong)',
            color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.55,
          }}>
            <div className="eyebrow" style={{ color: 'var(--amethyst-lavender)', marginBottom: 8 }}>Tip</div>
            Warmup takes ~6 minutes. The conversation is where the positioning sharpens — don't rush past the use case step.
          </div>
        </div>

        {/* Battlecards table */}
        <div style={{ overflow: 'auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 140px 90px 140px 80px',
            gap: 16, padding: '20px 22px', borderBottom: '1px solid var(--border)',
            fontFamily: 'Josefin Sans', textTransform: 'uppercase',
            letterSpacing: '0.16em', fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 500,
          }}>
            <span>Product</span>
            <span>Competitor</span>
            <span>Status</span>
            <span>FUD items</span>
            <span>Updated</span>
            <span></span>
          </div>

          {loading ? (
            <div style={{ padding: '28px 22px', color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
          ) : battlecards.length === 0 ? (
            <div style={{ padding: '48px 22px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              No battlecards yet. Select a product and run research to get started.
            </div>
          ) : (
            battlecards.map(card => (
              <div key={card.id} onClick={() => navigate(`/battlecard/${card.id}`)} style={{
                display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 140px 90px 140px 80px',
                alignItems: 'center', gap: 16, padding: '16px 22px',
                borderBottom: '1px solid var(--divider)', cursor: 'pointer',
              }}>
                <div style={{ fontFamily: 'Josefin Sans', fontSize: 15, fontWeight: 500, letterSpacing: '0.01em' }}>
                  {card.product_name}
                </div>
                <div style={{ fontFamily: 'Josefin Sans', fontSize: 15, fontWeight: 500, color: 'var(--amber-gold)' }}>
                  vs {card.competitor_name}
                </div>
                <StatusBadge status={card.status} />
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-muted)' }}>—</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(card.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div style={{
                  textAlign: 'right', fontFamily: 'Josefin Sans',
                  textTransform: 'uppercase', letterSpacing: '0.14em',
                  fontSize: 11, color: 'var(--sapphire-sky)',
                }}>Open →</div>
              </div>
            ))
          )}

          <div style={{
            padding: '18px 22px', borderTop: '1px solid var(--divider)',
            color: 'var(--text-dim)', fontSize: 12, fontFamily: 'JetBrains Mono',
          }}>
            {battlecards.length} result{battlecards.length !== 1 ? 's' : ''}
          </div>
        </div>

      </div>
    </div>
  )
}