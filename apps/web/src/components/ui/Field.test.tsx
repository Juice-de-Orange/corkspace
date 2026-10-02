import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './Field'

describe('Field', () => {
  it('associates the label with the control via a generated id', () => {
    render(<Field label="Farbe">{(p) => <input {...p} type="text" />}</Field>)
    // getByLabelText resolves the control through the <label htmlFor> association.
    const input = screen.getByLabelText('Farbe')
    expect(input.tagName).toBe('INPUT')
  })

  it('wires aria-describedby to the hint and error', () => {
    render(
      <Field label="Size" hint="8–200" error="Too large">
        {(p) => <input {...p} type="number" />}
      </Field>,
    )
    const input = screen.getByLabelText('Size')
    const describedBy = input.getAttribute('aria-describedby') ?? ''
    const ids = describedBy.split(' ').filter(Boolean)
    expect(ids.length).toBe(2)
    const described = ids.map((id) => document.getElementById(id)?.textContent)
    expect(described).toContain('8–200')
    expect(described).toContain('Too large')
  })

  it('keeps the badge out of the control accessible name', () => {
    render(
      <Field label="Hintergrund" badge={<span className="badge">Standard</span>}>
        {(p) => <input {...p} type="text" />}
      </Field>,
    )
    // The badge text must not leak into the label → getByLabelText('Hintergrund') still resolves.
    expect(screen.getByLabelText('Hintergrund').tagName).toBe('INPUT')
  })
})
