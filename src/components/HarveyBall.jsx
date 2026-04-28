export default function HarveyBall({ value = 0, size = 18, color = '#DDE4F0' }) {
  const r = size / 2 - 1
  const cx = size / 2
  const cy = size / 2
  let fillPath = null

  if (value === 4) {
    fillPath = <circle cx={cx} cy={cy} r={r} fill={color} />
  } else if (value > 0) {
    const angle = (value / 4) * Math.PI * 2
    const x = cx + r * Math.sin(angle)
    const y = cy - r * Math.cos(angle)
    const large = value >= 2 ? 1 : 0
    fillPath = (
      <path
        d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`}
        fill={color}
      />
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1.25" />
      {fillPath}
    </svg>
  )
}