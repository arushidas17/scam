import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { AuthLayout, AuthDivider } from '../components/auth/AuthLayout'
import { Field } from '../components/auth/Field'
import { PasswordStrength } from '../components/auth/PasswordStrength'
import { GoogleButton } from '../components/auth/GoogleButton'
import { Button } from '../components/ui/Button'
import { signUp, signInWithGoogle } from '../services/auth'
import { useAuth } from '../context/useAuth'
import {
  validateEmail,
  validateNewPassword,
  validateRequired,
  validateTerms,
} from '../lib/validation'

export default function Signup() {
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const [values, setValues] = useState({
    fullName: '',
    companyName: '',
    email: '',
    password: '',
  })
  const [accepted, setAccepted] = useState(false)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const validators = {
    fullName: (v) => validateRequired(v, 'full name'),
    companyName: (v) => validateRequired(v, 'company name'),
    email: (v) => validateEmail(v, { requireWork: true }),
    password: validateNewPassword,
  }

  const setField = (name) => (value) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validators[name](value) }))
    }
  }

  const handleBlur = (name) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validators[name](values[name]) }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    const nextErrors = {
      fullName: validators.fullName(values.fullName),
      companyName: validators.companyName(values.companyName),
      email: validators.email(values.email),
      password: validators.password(values.password),
      terms: validateTerms(accepted),
    }
    setErrors(nextErrors)
    setTouched({ fullName: true, companyName: true, email: true, password: true, terms: true })
    if (Object.values(nextErrors).some(Boolean)) return

    setSubmitting(true)
    try {
      await signUp(values)
      // Adopt the new session before navigating, or ProtectedRoute still sees
      // a signed-out context and sends us straight back here.
      refresh()
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(error.message || 'Could not create your account. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setFormError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      refresh()
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(error.message || 'Could not continue with Google. Try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const busy = submitting || googleLoading

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start scoring invoices in a few minutes. No card required."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-accent transition-colors duration-base ease-out hover:text-accent-300"
          >
            Log in
          </Link>
        </>
      }
    >
      <GoogleButton
        label="Continue with Google"
        onClick={handleGoogle}
        loading={googleLoading}
        disabled={submitting}
      />

      <AuthDivider />

      <form onSubmit={handleSubmit} noValidate className="space-y-1">
        <Field
          label="Full name"
          value={values.fullName}
          onChange={setField('fullName')}
          onBlur={handleBlur('fullName')}
          error={touched.fullName ? errors.fullName : ''}
          autoComplete="name"
          placeholder="Priya Ramesh"
          disabled={busy}
        />

        <Field
          label="Company name"
          value={values.companyName}
          onChange={setField('companyName')}
          onBlur={handleBlur('companyName')}
          error={touched.companyName ? errors.companyName : ''}
          autoComplete="organization"
          placeholder="Meridian Industries Pvt Ltd"
          disabled={busy}
        />

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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          disabled={busy}
        >
          <PasswordStrength value={values.password} />
        </Field>

        <div className="pt-2">
          <label className="flex cursor-pointer items-start gap-2.5 text-[0.84rem] leading-relaxed text-ink-secondary">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked)
                if (touched.terms) {
                  setErrors((prev) => ({ ...prev, terms: validateTerms(e.target.checked) }))
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, terms: true }))
                setErrors((prev) => ({ ...prev, terms: validateTerms(accepted) }))
              }}
              disabled={busy}
              aria-invalid={touched.terms && errors.terms ? 'true' : undefined}
              aria-describedby={touched.terms && errors.terms ? 'terms-error' : undefined}
              className="checkbox mt-0.5"
            />
            <span>
              I agree to the{' '}
              <a href="#" className="font-medium text-accent hover:text-accent-300">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="font-medium text-accent hover:text-accent-300">
                Privacy Policy
              </a>
              .
            </span>
          </label>

          <div aria-live="polite" className="min-h-[1.15rem]">
            {touched.terms && errors.terms && (
              <p
                id="terms-error"
                className="mt-1.5 flex items-start gap-1.5 text-[0.76rem] text-risk-suspicious"
              >
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.terms}
              </p>
            )}
          </div>
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
                Creating your workspace…
              </>
            ) : (
              <>
                Create account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
