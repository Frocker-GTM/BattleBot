import { useState } from 'react'

// ─────────────────────────────────────────────
// ADD YOUR PAINTINGS HERE
// Format: { src: '/art/filename.jpg', title: 'Painting Title' }
// Images go in: public/art/ in your local project folder
// ─────────────────────────────────────────────
const PAINTINGS = [
  { src: '/art/hummingbird.jpg', title: 'Ruby Throated Friend' },
  { src: '/art/bird.jpeg', title: 'Watching the Sunset' },
  { src: '/art/carpediem.jpg', title: 'Sieze the Day' },
  { src: '/art/penguin.jpeg', title: 'An Angry Penguin' },
  { src: '/art/adultsupervision.jpg', title: 'Adult Supervision Required' },
  { src: '/art/moon.jpeg', title: 'Office Mural' },
]

export default function Art() {
  const [lightbox, setLightbox] = useState(null) // index of open image, or null

  const prev = () => setLightbox(i => (i - 1 + PAINTINGS.length) % PAINTINGS.length)
  const next = () => setLightbox(i => (i + 1) % PAINTINGS.length)

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft')  prev()
    if (e.key === 'ArrowRight') next()
    if (e.key === 'Escape')     setLightbox(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', right: '-5%', top: '-10%',
          width: 1200, height: 600, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(45,125,210,0.10) 0%, transparent 60%)',
          filter: 'blur(20px)',
        }} />
        <div style={{
          position: 'absolute', left: '-10%', bottom: '0%',
          width: 900, height: 500, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 60%)',
          filter: 'blur(20px)',
        }} />
      </div>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(14px)',
        background: 'rgba(13,15,26,0.72)',
        borderBottom: '1px solid rgba(75,101,132,0.18)',
      }}>
        <div style={{
          maxWidth: 1240, margin: '0 auto',
          padding: '0 clamp(1.5rem, 4vw, 3.5rem)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: 76,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 8, height: 8, background: 'var(--amber)', transform: 'rotate(45deg)' }} />
            <span style={{
              fontFamily: 'Josefin Sans', textTransform: 'uppercase',
              letterSpacing: '0.22em', fontSize: '0.82rem', fontWeight: 500,
            }}>
              Bryan Finfrock
            </span>
          </div>
          <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            {[
              { label: 'Home',  path: '/' },
              { label: 'About', path: '/about' },
              { label: 'Art',   path: '/art', active: true },
              { label: 'App',   path: '/app' },
            ].map(({ label, path, active }) => (
              <a key={label} href={path} style={{
                fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                letterSpacing: '0.22em', fontSize: '0.78rem', fontWeight: 400,
                color: active ? 'var(--text)' : 'var(--text-dim)',
                textDecoration: 'none', padding: '0.4rem 0',
                borderBottom: active ? '1px solid var(--amber)' : '1px solid transparent',
              }}>{label}</a>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1240, margin: '0 auto',
        padding: '0 clamp(1.5rem, 4vw, 3.5rem)',
        paddingTop: 'clamp(4rem, 8vw, 7rem)',
        paddingBottom: 'clamp(4rem, 8vw, 7rem)',
      }}>

        {/* Page header */}
        <div style={{ marginBottom: '4rem' }}>
          <div className="eyebrow" style={{ marginBottom: '1rem', color: 'var(--amber)' }}>03 / ART</div>
          <h1 style={{
            fontFamily: 'Josefin Sans', fontWeight: 300,
            fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
            letterSpacing: '0.02em', lineHeight: 1.1,
            margin: '0 0 0.75rem',
          }}>
            Digital Photography & Acrylic Paintings.
          </h1>
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, var(--amber), transparent)',
            width: 120, marginTop: '1.5rem',
          }} />
          <p style={{
            marginTop: '1.5rem', fontSize: '1rem', lineHeight: 1.7,
            color: 'var(--text-dim)', maxWidth: '56ch',
          }}>
            Aphantasia is the inability to voluntarily create mental images in one's "mind's eye". Yet, my creative spirit requires satiation, which took me on an artistic journey. What began with a digital camera and simple editing tools has evolved into a passion for digital photography and arcylic painting. Click any piece to view it full size.
          </p>
        </div>

        {/* Gallery grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          {PAINTINGS.map((painting, i) => (
            <div
              key={i}
              onClick={() => setLightbox(i)}
              style={{
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: 'var(--bg-raised)',
                overflow: 'hidden',
                transition: 'border-color 200ms ease',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--amber)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              {/* Thumbnail */}
              <div style={{
                width: '100%', aspectRatio: '4/3',
                overflow: 'hidden', background: 'rgba(75,101,132,0.08)',
              }}>
                <img
                  src={painting.src}
                  alt={painting.title}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 300ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              </div>
              {/* Title */}
              <div style={{ padding: '0.9rem 1rem' }}>
                <div style={{
                  fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                  letterSpacing: '0.14em', fontSize: '0.78rem', fontWeight: 400,
                  color: 'var(--text-dim)',
                }}>{painting.title}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(75,101,132,0.18)',
        padding: '2.5rem 0', marginTop: '4rem',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          maxWidth: 1240, margin: '0 auto',
          padding: '0 clamp(1.5rem, 4vw, 3.5rem)',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem',
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
            color: 'var(--text-dim)', letterSpacing: '0.04em',
          }}>
            BRYAN FINFROCK / / © 2026
          </div>
          <div style={{ display: 'flex', gap: '1.6rem' }}>
            {[
              { label: 'LinkedIn',  href: 'https://linkedin.com/in/bryanfinfrock' },
              { label: 'Email',     href: 'mailto:bryan.finfrock@gmail.com' },
              { label: 'BattleBot', href: '/app' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{
                fontFamily: 'Josefin Sans', textTransform: 'uppercase',
                letterSpacing: '0.22em', fontSize: '0.74rem',
                color: 'var(--text-dim)', textDecoration: 'none',
                transition: 'color 160ms ease',
              }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--amber)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >{label}</a>
            ))}
          </div>
        </div>
      </footer>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          ref={el => el && el.focus()}
          onClick={e => { if (e.target === e.currentTarget) setLightbox(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(8,10,18,0.93)',
            backdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '2rem',
            outline: 'none',
          }}
        >
          {/* Close */}
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: 20, right: 24,
              background: 'none', border: 'none',
              color: 'var(--text-dim)', fontSize: 22,
              cursor: 'pointer', lineHeight: 1,
              transition: 'color 160ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--amber)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
          >✕</button>

          {/* Counter */}
          <div style={{
            position: 'absolute', top: 24, left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'JetBrains Mono', fontSize: '0.72rem',
            color: 'var(--text-dim)', letterSpacing: '0.08em',
          }}>
            {lightbox + 1} / {PAINTINGS.length}
          </div>

          {/* Prev arrow */}
          <button
            onClick={prev}
            style={{
              position: 'absolute', left: 20, top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: '1px solid rgba(75,101,132,0.35)',
              color: 'var(--text-dim)', fontSize: 20,
              width: 44, height: 44, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 160ms ease, color 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(75,101,132,0.35)'; e.currentTarget.style.color = 'var(--text-dim)' }}
          >←</button>

          {/* Image */}
          <div style={{ maxWidth: '85vw', maxHeight: '78vh', textAlign: 'center' }}>
            <img
              src={PAINTINGS[lightbox].src}
              alt={PAINTINGS[lightbox].title}
              style={{
                maxWidth: '100%', maxHeight: '72vh',
                objectFit: 'contain',
                border: '1px solid rgba(75,101,132,0.25)',
              }}
            />
            <div style={{
              marginTop: '1rem',
              fontFamily: 'Josefin Sans', textTransform: 'uppercase',
              letterSpacing: '0.18em', fontSize: '0.8rem',
              color: 'var(--text-dim)',
            }}>
              {PAINTINGS[lightbox].title}
            </div>
          </div>

          {/* Next arrow */}
          <button
            onClick={next}
            style={{
              position: 'absolute', right: 20, top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: '1px solid rgba(75,101,132,0.35)',
              color: 'var(--text-dim)', fontSize: 20,
              width: 44, height: 44, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 160ms ease, color 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(75,101,132,0.35)'; e.currentTarget.style.color = 'var(--text-dim)' }}
          >→</button>
        </div>
      )}
    </div>
  )
}
