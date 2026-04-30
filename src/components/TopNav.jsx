import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function TopNav({ active = 'Dashboard', breadcrumb = null }) {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{
      height: 56, borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', background: 'var(--bg)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, background: 'var(--amber)',
            transform: 'rotate(45deg)',
          }} />
          <span className="font-display" style={{
            fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.22em', fontSize: 13,
          }}>BattleBot</span>
          <span style={{
            color: 'var(--text-dim)', fontSize: 11,
            marginLeft: 4, fontFamily: 'JetBrains Mono',
          }}>v0.6</span>
        </div>
        {breadcrumb && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            color: 'var(--text-muted)', fontSize: 13,
          }}>
            <span style={{ color: 'var(--text-dim)' }}>/</span>
            {breadcrumb}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        {['Dashboard', 'Products', 'Battlecards'].map(item => (
        <span
          key={item}
          onClick={() => navigate('/dashboard')}
            style={{
              fontFamily: 'Josefin Sans', fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: 11,
              color: item === active ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: item === active ? '1px solid var(--amber)' : '1px solid transparent',
              paddingBottom: 4, paddingTop: 4, cursor: 'pointer',
            }}
          >{item}</span>
        ))}

        <div
          onClick={handleSignOut}
          title="Sign out"
          style={{
            width: 30, height: 30, borderRadius: '50%',
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-raised)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Josefin Sans', fontWeight: 600, fontSize: 11,
            color: 'var(--amber-gold)', letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >BF</div>
      </div>
    </div>
  )
}