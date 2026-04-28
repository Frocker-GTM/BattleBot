export default function StatusBadge({ status, label }) {
  const map = {
    pending:   { dot: '#5C6783', text: '#8C95AE', bg: 'rgba(92,103,131,0.12)',  border: 'rgba(92,103,131,0.3)',  label: 'Pending' },
    running:   { dot: '#2D7DD2', text: '#5FA8E8', bg: 'rgba(45,125,210,0.10)',  border: 'rgba(45,125,210,0.35)', label: 'Running' },
    complete:  { dot: '#4ADE80', text: '#86EFAC', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.30)', label: 'Complete' },
    needs:     { dot: '#E8A020', text: '#F2C46D', bg: 'rgba(232,160,32,0.10)',  border: 'rgba(232,160,32,0.35)', label: 'Needs update' },
    error:     { dot: '#EF4444', text: '#FCA5A5', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.35)',  label: 'Error' },
    draft:     { dot: '#8B5CF6', text: '#B794FA', bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.35)', label: 'Draft' },
    published: { dot: '#4ADE80', text: '#86EFAC', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.30)', label: 'Published' },
    approved:  { dot: '#4ADE80', text: '#86EFAC', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.30)', label: 'Approved' },
  }
  const s = map[status] || map.pending

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '4px 10px 4px 8px',
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 999, color: s.text,
      fontFamily: 'Josefin Sans', fontWeight: 500, fontSize: 11,
      textTransform: 'uppercase', letterSpacing: '0.14em',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: s.dot,
        animation: status === 'running' ? 'bbpulse 1.6s infinite' : 'none',
      }} />
      {label || s.label}
    </span>
  )
} 
