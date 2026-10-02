import { pushError } from '../canvas/state/toast-store'
import { t } from '../i18n'

/** Run a save; on failure revert the optimistic store change (if any) and surface a toast. */
export async function saving(
  fn: () => Promise<unknown>,
  revert?: () => void,
  message?: string,
): Promise<void> {
  try {
    await fn()
  } catch (e) {
    revert?.()
    // Resolve the default here (at error time) so it reads the current language, not the load-time one.
    pushError(message ?? t('cmd.saveFailed'))
    throw e
  }
}
