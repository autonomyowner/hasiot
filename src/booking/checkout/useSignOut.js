import { useRef, useState } from 'react'
import { authClient } from '../../lib/auth-client'

/**
 * "Sign out" for the traveller pages. Nothing navigates afterwards: the pages
 * read the session through useViewer, so a signed-out checkout simply opens
 * its sign-in step again, with the traveller's choice still in the URL.
 */
export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false)
  const busy = useRef(false)

  const signOut = async () => {
    if (busy.current) return
    busy.current = true
    setSigningOut(true)
    try {
      const result = await authClient.signOut()
      if (result?.error) throw result
    } catch (err) {
      console.error('[booking] sign-out failed:', err)
    } finally {
      busy.current = false
      setSigningOut(false)
    }
  }

  return { signOut, signingOut }
}

export default useSignOut
