import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { AuthLayout, AuthDivider } from '../components/auth/AuthLayout'
import { Field } from '../components/auth/Field'
import { GoogleButton } from '../components/auth/GoogleButton'
import { GOOGLE_AUTH_ENABLED } from '../lib/features'
import { Button } from '../components/ui/Button'
import { signIn, signInWithGoogle } from '../services/auth'
import { useAuth } from '../context/useAuth'
import { validateEmail, validateLoginPassword } from '../lib/validation'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh } = useAuth()

  // Where ProtectedRoute bounced them from, if anywhere. The api client also
  // sets ?next= when it redirects on a 401, so both routes back are honoured.
  const destination =
    location.state?.from ??
    new URLSearchParams(location.search).get('next') ??
    '/dashboard'

  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const validators = {
    email: validateEmail,
    password: validateLoginPassword,
  }

  const setField = (name) => (value) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear a shown error as soon as the field becomes valid again
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validators[name](value) }))
    }
  }

  // Validate on blur — "inline as the user leaves each field"
  const handleBlur = (name) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validators[name](values[name]) }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    const nextErrors = {
      email: validators.email(values.email),
      password: validators.password(values.password),
    }
    setErrors(nextErrors)
    setTouched({ email: true, password: true })
    if (Object.values(nextErrors).some(Boolean)) return

    setSubmitting(true)
    try {
      await signIn({ ...values, remember })
      // Adopt the new session before navigating, or ProtectedRoute still sees
      // a signed-out context and sends us straight back here.
      await refresh()
      navigate(destination, { replace: true })
    } catch (error) {
      setFormError(error.message || 'Could not sign you in. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setFormError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      await refresh()
      navigate(destination, { replace: true })
    } catch (error) {
      setFormError(error.message || 'Could not sign you in with Google. Try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const busy = submitting || googleLoading

  return (
    <AuthLayout
      title="Log in to Fraud Guardian"
      subtitle="Pick up your invoice queue where you left it."
      footer={
        <>
          New to Fraud Guardian?{' '}
          <Link
            to="/signup"
            className="font-medium text-accent transition-colors duration-base ease-out hover:text-accent-300"
          >
            Create an account
          </Link>
        </>
      }
    >
      {/* Hidden until Google OAuth is enabled in Supabase; the divider goes
          with it, since "OR" with nothing above it reads as a mistake. */}
      {GOOGLE_AUTH_ENABLED && (
        <>
          <GoogleButton
            label="Continue with Google"
            onClick={handleGoogle}
            loading={googleLoading}
            disabled={submitting}
          />

          <AuthDivider />
        </>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-1">
        <Field
          label="Work email"
          type="email"
          inputMode="email"
          value={values.email}
          onChange={setField('email')}
          onBlur={handleBlur('email')}
          error={touched.email ? errors.email : ''}
          autoComplete="email"
          placeholder="you@company.in"
          disabled={busy}
        />

        <Field
          label="Password"
          type="password"
          value={values.password}
          onChange={setField('password')}
          onBlur={handleBlur('password')}
          error={touched.password ? errors.password : ''}
          autoComplete="current-password"
          placeholder="Your password"
          disabled={busy}
        />

        <div className="flex items-center justify-between gap-4 pb-1 pt-1">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-[0.84rem] text-ink-secondary">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={busy}
              className="checkbox"
            />
            Remember me
          </label>

          <a
            href="#"
            className="text-[0.84rem] font-medium text-accent transition-colors duration-base
                       ease-out hover:text-accent-300"
          >
            Forgot password?
          </a>
        </div>

        {formError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-risk-suspicious-edge
                       bg-risk-suspicious-dim px-3 py-2.5 text-[0.82rem] text-risk-suspicious"
          >
            <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            {formError}
          </p>
        )}

        <div className="pt-3">
          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Signing you in…
              </>
            ) : (
              <>
                Log in
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
