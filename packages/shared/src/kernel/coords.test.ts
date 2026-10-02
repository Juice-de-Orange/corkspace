import { describe, expect, it } from 'vitest'
import {
  camera,
  screenPoint,
  screenRect,
  screenSize,
  worldPoint,
  worldRect,
  worldSize,
} from './coords'

describe('coordinate constructors', () => {
  it('builds world/screen points', () => {
    expect(worldPoint(1, 2)).toEqual({ x: 1, y: 2 })
    expect(screenPoint(3, 4)).toEqual({ x: 3, y: 4 })
  })

  it('builds world/screen sizes', () => {
    expect(worldSize(10, 20)).toEqual({ w: 10, h: 20 })
    expect(screenSize(30, 40)).toEqual({ w: 30, h: 40 })
  })

  it('builds world/screen rects', () => {
    expect(worldRect(1, 2, 3, 4)).toEqual({ x: 1, y: 2, w: 3, h: 4 })
    expect(screenRect(5, 6, 7, 8)).toEqual({ x: 5, y: 6, w: 7, h: 8 })
  })

  it('builds a camera', () => {
    expect(camera(0, 0, 1)).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})
