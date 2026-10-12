import { useValue } from 'signia-react'
import { useT } from '../i18n'
import { demoAtom } from '../lib/brand'

/** The notice every page of a public demo shows (DEMO_MODE=on); nothing on a normal instance. */
export function DemoBanner() {
  const t = useT()
  const demo = useValue(demoAtom)
  if (!demo) {
    return null
  }
  return (
    <div className="demo-banner" role="status">
      {t('demo.banner')}
    </div>
  )
}
