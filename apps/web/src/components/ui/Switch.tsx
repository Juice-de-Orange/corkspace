interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  /** Accessible name for the toggle. */
  label: string
  disabled?: boolean
}

/** Accessible on/off toggle: a real `role="switch"` with `aria-checked`, keyboard-operable. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  )
}
