/**
 * Branded World vs Screen coordinate types — the SINGLE definition for the whole
 * codebase (docs/adr/). World and Screen points/sizes/rects are
 * non-interchangeable at compile time via a phantom `unique symbol`; the only place
 * that converts between them is `@corkspace/engine`'s camera conversion boundary.
 */

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

/** Plain, unbranded 2D primitives for internal arithmetic. */
export interface Vec2 {
  x: number
  y: number
}
export interface Size {
  w: number
  h: number
}
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** The camera: world point at the top-left offset (screen px) and a zoom factor. */
export interface Camera {
  x: number
  y: number
  zoom: number
}

export type WorldPoint = Brand<Vec2, 'world-point'>
export type ScreenPoint = Brand<Vec2, 'screen-point'>
export type WorldSize = Brand<Size, 'world-size'>
export type ScreenSize = Brand<Size, 'screen-size'>
export type WorldRect = Brand<Rect, 'world-rect'>
export type ScreenRect = Brand<Rect, 'screen-rect'>

export const worldPoint = (x: number, y: number): WorldPoint => ({ x, y }) as WorldPoint
export const screenPoint = (x: number, y: number): ScreenPoint => ({ x, y }) as ScreenPoint
export const worldSize = (w: number, h: number): WorldSize => ({ w, h }) as WorldSize
export const screenSize = (w: number, h: number): ScreenSize => ({ w, h }) as ScreenSize
export const worldRect = (x: number, y: number, w: number, h: number): WorldRect =>
  ({ x, y, w, h }) as WorldRect
export const screenRect = (x: number, y: number, w: number, h: number): ScreenRect =>
  ({ x, y, w, h }) as ScreenRect

export const camera = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom })
