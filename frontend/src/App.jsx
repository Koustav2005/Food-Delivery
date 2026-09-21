import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'
import AuthPage from './pages/Auth/AuthPage'
import RestaurantDashboard from './pages/Restaurant/RestaurantDashboard'

function App() {
  const [checking, setChecking] = useState(true)
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)

  useEffect(() => {
    let active = true

    const loadRole = async (nextSession) => {
      if (!nextSession) {
        if (active) {
          setSession(null)
          setRole(null)
          setChecking(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', nextSession.user.id)

      if (error) console.error('Failed to load role for signed-in user:', error)

      if (!active) return
      setSession(nextSession)
      // A user should only ever be in one role table, but if a signup flow
      // left a stray row behind, prefer the non-customer role over crashing.
      const rows = data ?? []
      setRole(rows.find((r) => r.role !== 'customer')?.role ?? rows[0]?.role ?? null)
      setChecking(false)
    }

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      loadRole(initialSession)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setChecking(true)
      loadRole(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  if (checking) return null

  if (session && role === 'restaurant') {
    return <RestaurantDashboard user={session.user} />
  }

  return <AuthPage />
}

export default App
