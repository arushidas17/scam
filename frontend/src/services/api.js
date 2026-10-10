/**
 * The one way this app talks to the backend.
 *
 * Every request goes through here so there is a single place that attaches the
 * session token, interprets a failure, and decides what the user is told. No
 * service falls back to mock data: showing invented invoices when the backend
 * is down would be worse than showing nothing, because the numbers on screen
 * are the ones somebody is about to pay against.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

/** Raised for every failed request, with a message fit to show the user. */
export class ApiError extends Error {
  constructor(message, { status = 0, detail = null, cause = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.cause = cause
  }

  /** The backend could not be reached at all, as opposed to refusing. */
  get isOffline() {
    return this.status === 0
  }
}

/** Where to send someone whose session has gone. */
function redirectToLogin() {
  if (typeof window === 'undefined') return
  const { pathname, search } = window.location
  if (pathname === '/login' || pathname === '/signup') return
  const next = encodeURIComponent(pathname + search)
  window.location.assign(`/login?next=${next}`)
}

async function accessToken() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

/**
 * Pull a readable message out of whatever the backend returned.
 *
 * FastAPI's `detail` is a string for our own errors and an array for schema
 * validation failures, so both are handled rather than printing "[object
 * Object]" at the user.
 */
function messageFrom(payload, status) {
  const detail = payload?.detail

  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message
  }
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : null
    const msg = first?.msg || 'That value was not accepted.'
    return field ? `${field}: ${msg}` : msg
  }

  if (status === 404) return 'That record could not be found.'
  if (status === 409) return 'That action conflicts with the current state.'
  if (status >= 500) return 'The server ran into a problem. Try again in a moment.'
  return `The request failed (${status}).`
}

/**
 * Make a request.
 *
 * `body` is sent as JSON unless it is already FormData, in which case the
 * browser sets the multipart boundary itself — setting Content-Type by hand
 * there produces a boundary-less header the server cannot parse.
 */
export async function request(path, { method = 'GET', body, params, signal } = {}) {
  if (!isSupabaseConfigured) {
    throw new ApiError(
      'This app is not configured yet. Set VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env and restart the dev server.',
      { status: 0 },
    )
  }

  const url = new URL(BASE_URL + path)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  const headers = {}
  const token = await accessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause
    throw new ApiError(
      `Could not reach the server at ${BASE_URL}. Check that the backend is running.`,
      { status: 0, cause },
    )
  }

  if (response.status === 401) {
    // The session is gone or was never valid. Send them to sign in rather than
    // leaving a page of empty panels with no explanation.
    redirectToLogin()
    throw new ApiError('Your session has expired. Please sign in again.', { status: 401 })
  }

  if (response.status === 204) return null

  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    throw new ApiError(messageFrom(payload, response.status), {
      status: response.status,
      detail: payload?.detail ?? null,
    })
  }

  return payload
}

export const api = {
  get: (path, params, options) => request(path, { ...options, method: 'GET', params }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
}

/** Numbers cross the wire as strings so no precision is lost; pages want numbers. */
export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
