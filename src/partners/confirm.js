import { createContext, useContext } from 'react'

/**
 * The layout's one confirm dialog (admin useConfirm), shared with every page
 * and component under it. Resolves `{ reason }` or null, like useConfirm.
 */
export const PartnerConfirmContext = createContext(async () => null)

export function usePartnerConfirm() {
  return useContext(PartnerConfirmContext)
}
