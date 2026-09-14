import { useEffect, useMemo, useRef, useState } from 'react'
import { ROLES, VEHICLE_TYPES } from './roles'
import {
  IconMail,
  IconLock,
  IconPhone,
  IconUser,
  IconEye,
  IconEyeOff,
  IconStore,
  IconBike,
  IconCheck,
  IconGoogle,
  IconFacebook,
  Logomark,
} from './icons'
import './AuthPage.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[6-9]\d{9}$/

const EMPTY_FORM = {
  fullName: '',
  identifier: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  roleField: '',
  remember: false,
  terms: false,
}

function passwordStrength(password) {
  if (!password) return { score: 0, label: '' }
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] }
}

export default function AuthPage() {
  const [roleId, setRoleId] = useState('customer')
  const [mode, setMode] = useState('login')
  const [identifierType, setIdentifierType] = useState('email')
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const timeoutRef = useRef(null)

  const role = useMemo(() => ROLES.find((r) => r.id === roleId), [roleId])

  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, id) => ({
        id,
        size: 3 + Math.round(Math.random() * 5),
        x: Math.round(Math.random() * 100),
        dur: 10 + Math.round(Math.random() * 10),
        delay: -Math.round(Math.random() * 18),
        drift: Math.round((Math.random() - 0.5) * 60),
      })),
    [],
  )

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setErrors({})
    setSuccess(false)
  }

  const switchRole = (nextRoleId) => {
    setRoleId(nextRoleId)
    setErrors({})
    setSuccess(false)
    setField('roleField', '')
  }

  const validate = () => {
    const next = {}

    if (mode === 'login') {
      if (!form.identifier.trim()) {
        next.identifier = `Enter your ${identifierType}`
      } else if (identifierType === 'email' && !EMAIL_RE.test(form.identifier)) {
        next.identifier = 'Enter a valid email address'
      } else if (identifierType === 'phone' && !PHONE_RE.test(form.identifier)) {
        next.identifier = 'Enter a valid 10-digit mobile number'
      }
      if (!form.password) next.password = 'Enter your password'
    } else {
      if (!form.fullName.trim()) next.fullName = 'Enter your full name'
      if (!EMAIL_RE.test(form.email)) next.email = 'Enter a valid email address'
      if (!PHONE_RE.test(form.phone)) next.phone = 'Enter a valid 10-digit mobile number'
      if (form.password.length < 8) next.password = 'Use at least 8 characters'
      if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match'
      if ((roleId === 'restaurant' || roleId === 'driver') && !form.roleField) {
        next.roleField =
          roleId === 'restaurant' ? 'Enter your restaurant name' : 'Select your vehicle type'
      }
      if (!form.terms) next.terms = 'You must accept the terms to continue'
    }

    return next
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setSubmitting(true)
    timeoutRef.current = setTimeout(() => {
      setSubmitting(false)
      setSuccess(true)
    }, 1100)
  }

  const strength = passwordStrength(form.password)

  return (
    <div className="auth-page" data-role={roleId}>
      <div className="auth-hero">
        <div className="hero-blobs" aria-hidden="true">
          <span />
        </div>
        <div className="hero-particles" aria-hidden="true">
          {particles.map((p) => (
            <span
              key={p.id}
              style={{
                '--size': `${p.size}px`,
                '--x': `${p.x}%`,
                '--dur': `${p.dur}s`,
                '--delay': `${p.delay}s`,
                '--drift': `${p.drift}px`,
              }}
            />
          ))}
        </div>
        <div className="floating-emoji" aria-hidden="true">
          {role.emoji.map((e, i) => (
            <span key={e} style={{ '--i': i }}>
              {e}
            </span>
          ))}
        </div>

        <div className="hero-content">
          <div className="brand">
            <Logomark />
            <span>Tiffin</span>
          </div>

          <div className="hero-copy" key={roleId}>
            <h1>{role.headline}</h1>
            <p>{role.subheadline}</p>
            <ul className="hero-features">
              {role.features.map((f) => (
                <li key={f.text}>
                  <span className="feature-icon">{f.icon}</span>
                  {f.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="hero-stats">
            {role.stats.map((s) => (
              <div key={s.label}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand">
            <Logomark />
            <span>Tiffin</span>
          </div>

          <div className="role-tabs" role="tablist" aria-label="Continue as">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={roleId === r.id}
                className={roleId === r.id ? 'active' : ''}
                onClick={() => switchRole(r.id)}
              >
                {r.id === 'customer' && <IconUser />}
                {r.id === 'restaurant' && <IconStore />}
                {r.id === 'driver' && <IconBike />}
                {r.label}
              </button>
            ))}
          </div>

          {success ? (
            <div className="success-state">
              <div className="success-icon">
                <IconCheck />
              </div>
              <h2>{mode === 'login' ? 'Welcome back!' : 'Account created!'}</h2>
              <p>
                {mode === 'login'
                  ? `You're logged in as a ${role.label.toLowerCase()}.`
                  : "We've sent a verification link — this is a demo, no backend is wired up yet."}
              </p>
              <button
                type="button"
                className="submit-btn"
                onClick={() => {
                  setSuccess(false)
                  setForm(EMPTY_FORM)
                }}
              >
                Back to {mode === 'login' ? 'login' : 'sign up'}
              </button>
            </div>
          ) : (
            <>
              <div className="mode-tabs">
                <button
                  type="button"
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => switchMode('login')}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className={mode === 'signup' ? 'active' : ''}
                  onClick={() => switchMode('signup')}
                >
                  Sign up
                </button>
                <span className={`mode-slider ${mode}`} aria-hidden="true" />
              </div>

              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {mode === 'signup' && (
                  <div className="field">
                    <label htmlFor="fullName">Full name</label>
                    <div className={`input-wrap ${errors.fullName ? 'invalid' : ''}`}>
                      <IconUser className="input-icon" />
                      <input
                        id="fullName"
                        type="text"
                        autoComplete="name"
                        placeholder="Ananya Sharma"
                        value={form.fullName}
                        onChange={(e) => setField('fullName', e.target.value)}
                      />
                    </div>
                    {errors.fullName && <span className="error-text">{errors.fullName}</span>}
                  </div>
                )}

                {mode === 'login' ? (
                  <div className="field">
                    <div className="field-label-row">
                      <label htmlFor="identifier">
                        {identifierType === 'email' ? 'Email address' : 'Mobile number'}
                      </label>
                      <div className="identifier-toggle">
                        <button
                          type="button"
                          className={identifierType === 'email' ? 'active' : ''}
                          onClick={() => {
                            setIdentifierType('email')
                            setField('identifier', '')
                          }}
                        >
                          Email
                        </button>
                        <button
                          type="button"
                          className={identifierType === 'phone' ? 'active' : ''}
                          onClick={() => {
                            setIdentifierType('phone')
                            setField('identifier', '')
                          }}
                        >
                          Phone
                        </button>
                      </div>
                    </div>
                    <div className={`input-wrap ${errors.identifier ? 'invalid' : ''}`}>
                      {identifierType === 'email' ? (
                        <IconMail className="input-icon" />
                      ) : (
                        <IconPhone className="input-icon" />
                      )}
                      <input
                        id="identifier"
                        type={identifierType === 'email' ? 'email' : 'tel'}
                        autoComplete={identifierType === 'email' ? 'email' : 'tel'}
                        placeholder={identifierType === 'email' ? 'you@example.com' : '98765 43210'}
                        value={form.identifier}
                        onChange={(e) => setField('identifier', e.target.value)}
                      />
                    </div>
                    {errors.identifier && <span className="error-text">{errors.identifier}</span>}
                  </div>
                ) : (
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="email">Email address</label>
                      <div className={`input-wrap ${errors.email ? 'invalid' : ''}`}>
                        <IconMail className="input-icon" />
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={form.email}
                          onChange={(e) => setField('email', e.target.value)}
                        />
                      </div>
                      {errors.email && <span className="error-text">{errors.email}</span>}
                    </div>
                    <div className="field">
                      <label htmlFor="phone">Mobile number</label>
                      <div className={`input-wrap ${errors.phone ? 'invalid' : ''}`}>
                        <IconPhone className="input-icon" />
                        <input
                          id="phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="98765 43210"
                          value={form.phone}
                          onChange={(e) => setField('phone', e.target.value)}
                        />
                      </div>
                      {errors.phone && <span className="error-text">{errors.phone}</span>}
                    </div>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className={`input-wrap ${errors.password ? 'invalid' : ''}`}>
                    <IconLock className="input-icon" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setField('password', e.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                  {mode === 'signup' && form.password && (
                    <div className="strength-meter" data-score={strength.score}>
                      <div className="strength-bars">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className={i < strength.score ? 'filled' : ''} />
                        ))}
                      </div>
                      <span className="strength-label">{strength.label}</span>
                    </div>
                  )}
                  {errors.password && <span className="error-text">{errors.password}</span>}
                </div>

                {mode === 'signup' && (
                  <div className="field">
                    <label htmlFor="confirmPassword">Confirm password</label>
                    <div className={`input-wrap ${errors.confirmPassword ? 'invalid' : ''}`}>
                      <IconLock className="input-icon" />
                      <input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={form.confirmPassword}
                        onChange={(e) => setField('confirmPassword', e.target.value)}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                        onClick={() => setShowConfirm((v) => !v)}
                      >
                        {showConfirm ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <span className="error-text">{errors.confirmPassword}</span>
                    )}
                  </div>
                )}

                {mode === 'signup' && roleId === 'restaurant' && (
                  <div className="field">
                    <label htmlFor="roleField">Restaurant name</label>
                    <div className={`input-wrap ${errors.roleField ? 'invalid' : ''}`}>
                      <IconStore className="input-icon" />
                      <input
                        id="roleField"
                        type="text"
                        placeholder="Spice Route Kitchen"
                        value={form.roleField}
                        onChange={(e) => setField('roleField', e.target.value)}
                      />
                    </div>
                    {errors.roleField && <span className="error-text">{errors.roleField}</span>}
                  </div>
                )}

                {mode === 'signup' && roleId === 'driver' && (
                  <div className="field">
                    <label htmlFor="roleField">Vehicle type</label>
                    <div className={`input-wrap select-wrap ${errors.roleField ? 'invalid' : ''}`}>
                      <IconBike className="input-icon" />
                      <select
                        id="roleField"
                        value={form.roleField}
                        onChange={(e) => setField('roleField', e.target.value)}
                      >
                        <option value="" disabled>
                          Select a vehicle
                        </option>
                        {VEHICLE_TYPES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.roleField && <span className="error-text">{errors.roleField}</span>}
                  </div>
                )}

                {mode === 'login' ? (
                  <div className="form-row-between">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={form.remember}
                        onChange={(e) => setField('remember', e.target.checked)}
                      />
                      <span>Remember me</span>
                    </label>
                    <a href="#forgot-password" onClick={(e) => e.preventDefault()}>
                      Forgot password?
                    </a>
                  </div>
                ) : (
                  <div className="field">
                    <label className={`checkbox ${errors.terms ? 'invalid' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.terms}
                        onChange={(e) => setField('terms', e.target.checked)}
                      />
                      <span>
                        I agree to the <a href="#terms" onClick={(e) => e.preventDefault()}>Terms</a>{' '}
                        and <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
                      </span>
                    </label>
                    {errors.terms && <span className="error-text">{errors.terms}</span>}
                  </div>
                )}

                <button type="submit" className="submit-btn" disabled={submitting} aria-busy={submitting}>
                  {submitting ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : mode === 'login' ? (
                    `Log in as ${role.label}`
                  ) : (
                    'Create account'
                  )}
                </button>
              </form>

              <div className="divider">
                <span>or continue with</span>
              </div>

              <div className="social-row">
                <button type="button">
                  <IconGoogle /> Google
                </button>
                <button type="button">
                  <IconFacebook /> Facebook
                </button>
              </div>

              <p className="switch-mode">
                {mode === 'login' ? (
                  <>
                    New to Tiffin?{' '}
                    <button type="button" onClick={() => switchMode('signup')}>
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button type="button" onClick={() => switchMode('login')}>
                      Log in
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
