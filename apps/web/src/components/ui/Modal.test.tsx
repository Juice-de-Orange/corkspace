import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="X">
        body
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders a labelled modal dialog and focuses the first focusable element when open', () => {
    render(
      <Modal open onClose={() => {}} title="Titel">
        <button type="button">Erste</button>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelId = dialog.getAttribute('aria-labelledby')
    expect(document.getElementById(labelId ?? '')?.textContent).toBe('Titel')
    // The close button is the first focusable in the header; auto-focused on open.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close')
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        <button type="button">b</button>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop mousedown but not on content mousedown', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        <button type="button">b</button>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    fireEvent.mouseDown(dialog)
    expect(onClose).not.toHaveBeenCalled()
    const backdrop = dialog.parentElement
    if (!backdrop) {
      throw new Error('no backdrop')
    }
    fireEvent.mouseDown(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
