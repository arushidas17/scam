import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Runs an async loader and tracks { data, loading, error }.
 *
 * Results from a superseded call are ignored, so fast filter changes on the
 * invoice list can never let a stale response overwrite a newer one.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const runRef = useRef(0)

  const run = useCallback(() => {
    const runId = runRef.current + 1
    runRef.current = runId

    setState((prev) => ({ ...prev, loading: true, error: null }))

    loader()
      .then((data) => {
        if (runRef.current === runId) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (runRef.current === runId) setState({ data: null, loading: false, error })
      })
    // The caller owns the dependency list for the loader it passes in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
    return () => {
      // Invalidate any call still in flight when the inputs change or we unmount.
      runRef.current += 1
    }
  }, [run])

  return { ...state, reload: run }
}
