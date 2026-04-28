import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'

// Site screens
import Home from './screens/site/Home.jsx'
import About from './screens/site/About.jsx'
import AppGateway from './screens/site/AppGateway.jsx'

// App screens
import Login from './screens/app/Login.jsx'
import Signup from './screens/app/Signup.jsx'
import Dashboard from './screens/app/Dashboard.jsx'
import Warmup from './screens/app/Warmup.jsx'
import Research from './screens/app/Research.jsx'
import Analyst from './screens/app/Analyst.jsx'
import Fud from './screens/app/Fud.jsx'
import Assembly from './screens/app/Assembly.jsx'
import Viewer from './screens/app/Viewer.jsx'

// Protected route wrapper
function Protected({ session, children }) {
  if (session === null) return <Navigate to="/login" replace />
  if (session === undefined) return null // still loading
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <Routes>
      {/* Public site */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/app" element={<AppGateway />} />

      {/* Auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected app */}
      <Route path="/dashboard" element={<Protected session={session}><Dashboard /></Protected>} />
      <Route path="/warmup" element={<Protected session={session}><Warmup /></Protected>} />
      <Route path="/research/:productId" element={<Protected session={session}><Research /></Protected>} />
      <Route path="/analyst/:productId" element={<Protected session={session}><Analyst /></Protected>} />
      <Route path="/fud/:productId/:competitorId" element={<Protected session={session}><Fud /></Protected>} />
      <Route path="/assembly/:productId/:competitorId" element={<Protected session={session}><Assembly /></Protected>} />
      <Route path="/battlecard/:battlecardId" element={<Protected session={session}><Viewer /></Protected>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}