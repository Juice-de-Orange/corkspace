import { camera } from '@corkspace/shared/kernel'
import { describe, expect, it } from 'vitest'
import { arrowKeyPan, panByScreen, panByWorld } from './pan'

describe('pan', () => {
  it('pans by a screen delta', () => {
    expect(panByScreen(camera(10, 20, 2), 5, -3)).toEqual({ x: 15, y: 17, zoom: 2 })
  })

  it('pans by a world delta scaled by zoom', () => {
    expect(panByWorld(camera(0, 0, 2), 10, 0)).toEqual({ x: -20, y: 0, zoom: 2 })
  })

  it('moves the viewport one step per arrow direction', () => {
    const c = camera(0, 0, 1)
    expect(arrowKeyPan(c, 'up', 80)).toEqual({ x: 0, y: 80, zoom: 1 })
    expect(arrowKeyPan(c, 'down', 80)).toEqual({ x: 0, y: -80, zoom: 1 })
    expect(arrowKeyPan(c, 'left', 80)).toEqual({ x: 80, y: 0, zoom: 1 })
    expect(arrowKeyPan(c, 'right', 80)).toEqual({ x: -80, y: 0, zoom: 1 })
  })
})
