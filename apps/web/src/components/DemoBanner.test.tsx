import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { demoAtom } from '../lib/brand'
import { DemoBanner } from './DemoBanner'

afterEach(() => {
  act(() => demoAtom.set(false))
})

describe('DemoBanner', () => {
  it('renders nothing outside the demo mode', () => {
    const { container } = render(<DemoBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('warns every visitor of a demo instance', () => {
    act(() => demoAtom.set(true))
    render(<DemoBanner />)
    expect(screen.getByRole('status').textContent).toBe(
      'Demo — data resets every hour. Do not enter personal data.',
    )
  })
})
