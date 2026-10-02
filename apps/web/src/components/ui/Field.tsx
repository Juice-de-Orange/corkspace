import { type ReactNode, useId } from 'react'

interface FieldChildProps {
  id: string
  'aria-describedby'?: string | undefined
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Optional trailing marker in the label row (e.g. a "Standard" badge). */
  badge?: ReactNode
  /** Render the control, wiring the generated id + aria-describedby for proper label association. */
  children: (props: FieldChildProps) => ReactNode
}

/**
 * A labelled form field: generates the id, wires `htmlFor` + `aria-describedby` (hint/error) so the
 * control is always correctly associated with its label — replacing the ad-hoc label rows that left
 * inputs unlabelled for screen readers.
 */
export function Field({ label, hint, error, badge, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      {/* The badge sits beside the <label> (not inside it) so it never pollutes the control's
          accessible name. */}
      <span className="field-label">
        <label htmlFor={id}>{label}</label>
        {badge}
      </span>
      {hint ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {children({ id, 'aria-describedby': describedBy })}
      {error ? (
        <span className="field-error" id={errId}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
