import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './utils/supabase'
import AuthPage from './pages/Auth/AuthPage'
import { ROLES, VEHICLE_TYPES } from './pages/Auth/roles'
import { attachRoleRow } from './pages/Auth/roleAttachment'
import RestaurantDashboard from './pages/Restaurant/RestaurantDashboard'
import CustomerApp from './pages/Customer/CustomerApp'
import DriverDashboard from './pages/Driver/DriverDashboard'
import AdminDashboard from './pages/Admin/AdminDashboard'

function activeRoleKey(userId) {
  return `tiffin-active-role-${userId}`
}

function App() {
  const [checking, setChecking] = useState(true)
  const [session, setSession] = useState(null)
  const [roles, setRoles] = useState([])
  const [activeRole, setActiveRole] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showRoleManager, setShowRoleManager] = useState(false)

  useEffect(() => {
    let active = true

    const loadRole = async (nextSession) => {
      if (!nextSession) {
        if (active) {
          setSession(null)
          setRoles([])
          setActiveRole(null)
          setIsAdmin(false)
          setChecking(false)
        }
        return
      }

      const [{ data, error }, { data: adminRow }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('id', nextSession.user.id),
        supabase.from('admins').select('id').eq('id', nextSession.user.id).maybeSingle(),
      ])

      if (error) console.error('Failed to load role for signed-in user:', error)

      if (!active) return
      setSession(nextSession)
      // One login can hold more than one role (customer + driver, etc). If
      // there's only one, just use it; if there are several, remember the
      // one this browser tab last chose (sessionStorage — a fresh tab
      // re-asks) rather than silently guessing.
      const roleNames = [...new Set((data ?? []).map((r) => r.role))]
      setRoles(roleNames)
      const stored = sessionStorage.getItem(activeRoleKey(nextSession.user.id))
      setActiveRole(roleNames.length === 1 ? roleNames[0] : roleNames.includes(stored) ? stored : null)
      setIsAdmin(Boolean(adminRow))
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

  if (!session) return <AuthPage />

  const pickRole = (roleName) => {
    sessionStorage.setItem(activeRoleKey(session.user.id), roleName)
    setActiveRole(roleName)
    setShowRoleManager(false)
  }

  const roleAdded = (roleName) => {
    setRoles((prev) => (prev.includes(roleName) ? prev : [...prev, roleName]))
    pickRole(roleName)
  }

  const mustPick = roles.length > 1 && !activeRole

  if (mustPick || showRoleManager) {
    return (
      <RoleManager
        user={session.user}
        roles={roles}
        canClose={!mustPick}
        onPick={pickRole}
        onRoleAdded={roleAdded}
        onClose={() => setShowRoleManager(false)}
      />
    )
  }

  const effectiveRole = activeRole ?? roles[0] ?? null

  return (
    <BrowserRouter>
      <button type="button" className="tiffin-switch-role-fab" onClick={() => setShowRoleManager(true)}>
        Account roles
      </button>
      <Routes>
        <Route
          path="/admin/*"
          element={isAdmin ? <AdminDashboard user={session.user} /> : <Navigate to="/" replace />}
        />
        <Route
          path="/*"
          element={
            effectiveRole === 'restaurant' ? (
              <RestaurantDashboard user={session.user} />
            ) : effectiveRole === 'driver' ? (
              <DriverDashboard user={session.user} />
            ) : (
              <CustomerApp user={session.user} isAdmin={isAdmin} />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

// Shown either as a forced step (multi-role account, hasn't picked one yet
// this tab) or opened manually via the "Account roles" button. Lets the
// user switch between roles they already have, or attach a new one to this
// same login without signing out — that's the "same email for every
// portal" flow AuthPage.jsx's signup handler enables.
function RoleManager({ user, roles, canClose, onPick, onRoleAdded, onClose }) {
  const [addingRoleId, setAddingRoleId] = useState(null)
  const [fieldValue, setFieldValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const existing = ROLES.filter((r) => roles.includes(r.id))
  const missing = ROLES.filter((r) => !roles.includes(r.id))

  const startAdding = (roleId) => {
    setAddingRoleId(roleId)
    setFieldValue(roleId === 'driver' ? VEHICLE_TYPES[0] : '')
    setError('')
  }

  const confirmAdd = async () => {
    if (addingRoleId === 'restaurant' && !fieldValue.trim()) {
      setError('Enter your restaurant name')
      return
    }
    setSaving(true)
    const { error: attachError } = await attachRoleRow(user, addingRoleId, { roleField: fieldValue })
    setSaving(false)
    if (attachError) {
      setError(attachError.message)
      return
    }
    onRoleAdded(addingRoleId)
  }

  return (
    <div className="tiffin-role-picker">
      <div className="tiffin-role-picker-card">
        <h1>{canClose ? 'Account roles' : 'Continue as…'}</h1>
        <p>
          {canClose
            ? 'Switch to a role you already have, or add a new one to this same account.'
            : 'This account has more than one role — pick which one to use.'}
        </p>

        <div className="tiffin-role-picker-grid">
          {existing.map((r) => (
            <button key={r.id} type="button" onClick={() => onPick(r.id)}>
              <span>{r.emoji[0]}</span>
              {r.label}
            </button>
          ))}
        </div>

        {missing.length > 0 && (
          <div className="tiffin-role-add">
            <p className="tiffin-role-add-label">Add another role to this account</p>
            <div className="tiffin-role-picker-grid">
              {missing.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={addingRoleId === r.id ? 'active' : ''}
                  onClick={() => startAdding(r.id)}
                >
                  <span>{r.emoji[0]}</span>+ {r.label}
                </button>
              ))}
            </div>

            {addingRoleId && (
              <div className="tiffin-role-add-form">
                {addingRoleId === 'restaurant' && (
                  <input
                    placeholder="Restaurant name"
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                  />
                )}
                {addingRoleId === 'driver' && (
                  <select value={fieldValue} onChange={(e) => setFieldValue(e.target.value)}>
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
                {error && <p className="tiffin-role-add-error">{error}</p>}
                <button type="button" onClick={confirmAdd} disabled={saving}>
                  {saving ? 'Adding…' : `Add ${ROLES.find((r) => r.id === addingRoleId).label} access`}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="tiffin-role-picker-footer">
          {canClose && (
            <button type="button" className="tiffin-role-picker-signout" onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="button" className="tiffin-role-picker-signout" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
