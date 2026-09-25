import { useEffect, useState } from 'react'
import { getVerificationStage, type VerificationStage } from './authApi'

const POLL_INTERVAL_MS = 2000

/**
 * Watches a verification that finishes somewhere else: with a SIM push the user approves in the
 * operator's app and the outcome reaches the API from the provider, so the browser can only ask.
 * Polling stops once the stage leaves `pending`; a failed request retries on the same schedule.
 */
export function useVerificationStage(verificationId: string, initial: VerificationStage) {
  const [stage, setStage] = useState<VerificationStage>(initial)

  useEffect(() => {
    if (stage !== 'pending') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const result = await getVerificationStage(verificationId)
        if (cancelled) return
        setStage(result.stage)
        if (result.stage === 'pending') timer = setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }
    timer = setTimeout(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [verificationId, stage])

  return stage
}
