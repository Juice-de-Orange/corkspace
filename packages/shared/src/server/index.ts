import { defaultResolver, defaultTransport } from './https-transport'
import { createSafeFetch } from './safe-fetch'

export * from './safe-fetch'

/** Production SSRF-safe fetcher (DNS + https, IP-pinned). Server-only. */
export const safeFetch = createSafeFetch({
  resolver: defaultResolver,
  transport: defaultTransport,
})
