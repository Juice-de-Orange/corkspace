import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { DialogProvider, useDialogs } from './dialogs'

function Harness() {
  const { prompt, confirm } = useDialogs()
  const [result, setResult] = useState<string>('')
  return (
    <div>
      <button
        type="button"
        onClick={async () => setResult(`prompt:${await prompt({ title: 'Name?', label: 'Name' })}`)}
      >
        ask-prompt
      </button>
      <button
        type="button"
        onClick={async () => setResult(`confirm:${await confirm({ title: 'Sicher?' })}`)}
      >
        ask-confirm
      </button>
      <output>{result}</output>
    </div>
  )
}

function renderHarness() {
  return render(
    <DialogProvider>
      <Harness />
    </DialogProvider>,
  )
}

describe('dialogs', () => {
  it('prompt resolves with the entered value on OK', async () => {
    renderHarness()
    fireEvent.click(screen.getByText('ask-prompt'))
    const input = await screen.findByLabelText('Name')
    fireEvent.change(input, { target: { value: 'Alex' } })
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('prompt:Alex'))
  })

  it('prompt resolves null on cancel', async () => {
    renderHarness()
    fireEvent.click(screen.getByText('ask-prompt'))
    await screen.findByLabelText('Name')
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('prompt:null'))
  })

  it('confirm resolves true on OK and false on cancel', async () => {
    renderHarness()
    fireEvent.click(screen.getByText('ask-confirm'))
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('confirm:true'))

    fireEvent.click(screen.getByText('ask-confirm'))
    fireEvent.click(await screen.findByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('confirm:false'))
  })
})
