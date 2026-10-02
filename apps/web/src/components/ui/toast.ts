import { useMemo } from 'react'
import { pushError, pushSuccess, pushToast } from '../../canvas/state/toast-store'

/**
 * Ergonomic access to the global toast stack. The underlying functions are module-level (a signia
 * store), so any surface can also import them directly — this hook just bundles them.
 */
export function useToast() {
  return useMemo(
    () => ({
      toast: (message: string) => pushToast(message, 'info'),
      success: pushSuccess,
      error: pushError,
    }),
    [],
  )
}
