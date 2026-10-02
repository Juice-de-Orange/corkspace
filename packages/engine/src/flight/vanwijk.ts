/**
 * Van Wijk & Nuij (2004) "Smooth and efficient zooming and panning".
 * Ported from d3-interpolate-zoom (ISC). A view is the world-space center + width `w`
 * (smaller `w` = more zoomed in). `at(t)` for t∈[0,1] gives the interpolated view; `S` is
 * the natural path length (used to scale duration).
 */
export interface View {
  cx: number
  cy: number
  w: number
}

export interface ViewInterpolation {
  S: number
  at: (t: number) => View
}

const cosh = (x: number): number => (Math.exp(x) + Math.exp(-x)) / 2
const sinh = (x: number): number => (Math.exp(x) - Math.exp(-x)) / 2
const tanh = (x: number): number => {
  const e = Math.exp(2 * x)
  return (e - 1) / (e + 1)
}

const EPS2 = 1e-12

export function interpolateView(from: View, to: View, rho = Math.SQRT2): ViewInterpolation {
  const ux0 = from.cx
  const uy0 = from.cy
  const w0 = from.w
  const ux1 = to.cx
  const uy1 = to.cy
  const w1 = to.w
  const dx = ux1 - ux0
  const dy = uy1 - uy0
  const d2 = dx * dx + dy * dy
  const rho2 = rho * rho
  const rho4 = rho2 * rho2

  if (d2 < EPS2) {
    // Same center: interpolate width exponentially.
    const S = Math.log(w1 / w0) / rho
    const at = (t: number): View => ({
      cx: ux0 + t * dx,
      cy: uy0 + t * dy,
      w: w0 * Math.exp(rho * t * S),
    })
    return { S, at }
  }

  const d1 = Math.sqrt(d2)
  const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1)
  const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1)
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0)
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1)
  const S = (r1 - r0) / rho
  const coshr0 = cosh(r0)

  const at = (t: number): View => {
    const s = t * S
    const u = (w0 / (rho2 * d1)) * (coshr0 * tanh(rho * s + r0) - sinh(r0))
    return {
      cx: ux0 + u * dx,
      cy: uy0 + u * dy,
      w: (w0 * coshr0) / cosh(rho * s + r0),
    }
  }

  return { S, at }
}
