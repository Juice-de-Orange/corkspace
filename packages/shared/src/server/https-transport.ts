import { request as httpsRequest } from 'node:https'
import type { LookupFunction } from 'node:net'
import { type FetchResponse, type FetchTransport, type Resolver, SsrfError } from './safe-fetch'

/** Default resolver: DNS lookup returning every address (IPv4 + IPv6). */
export const defaultResolver: Resolver = async (hostname) => {
  const { lookup } = await import('node:dns/promises')
  try {
    const records = await lookup(hostname, { all: true })
    return records.map((r) => r.address)
  } catch {
    return []
  }
}

/**
 * A `lookup` that never consults DNS: whatever hostname the socket asks for, it answers with the
 * pre-validated IP. Node asks in two shapes — a single address, or (`all: true`, the default
 * since the happy-eyeballs connect in Node 20+) a list — and rejects the wrong shape.
 */
export function pinnedLookup(pinnedIp: string): LookupFunction {
  const family = pinnedIp.includes(':') ? 6 : 4
  return (_host, options, cb) => {
    if (options.all) {
      cb(null, [{ address: pinnedIp, family }])
    } else {
      cb(null, pinnedIp, family)
    }
  }
}

/**
 * Transport over node https with the socket pinned to the pre-validated IP. TLS still verifies
 * the certificate against the URL's hostname; `ca` only swaps the trust store (tests).
 */
export const createHttpsTransport =
  (tls: { ca?: string | Buffer } = {}): FetchTransport =>
  (url, pinnedIp, opts) =>
    new Promise<FetchResponse>((resolve, reject) => {
      const req = httpsRequest(
        {
          ...tls,
          hostname: url.hostname,
          port: url.port ? Number(url.port) : 443,
          path: `${url.pathname}${url.search}`,
          method: 'GET',
          headers: { 'user-agent': opts.userAgent, accept: '*/*' },
          timeout: opts.timeoutMs,
          lookup: pinnedLookup(pinnedIp),
        },
        (res) => {
          const status = res.statusCode ?? 0
          const location = typeof res.headers.location === 'string' ? res.headers.location : null
          const contentType = (String(res.headers['content-type'] ?? '').split(';')[0] ?? '')
            .trim()
            .toLowerCase()
          const readBody = (maxBytes: number): Promise<Buffer> =>
            new Promise<Buffer>((rb, rj) => {
              const chunks: Buffer[] = []
              let total = 0
              res.on('data', (c: Buffer) => {
                total += c.length
                if (total > maxBytes) {
                  req.destroy()
                  rj(new SsrfError('response exceeded max bytes'))
                } else {
                  chunks.push(c)
                }
              })
              res.on('end', () => rb(Buffer.concat(chunks)))
              res.on('error', rj)
            })
          resolve({ status, location, contentType, readBody, cancel: () => req.destroy() })
        },
      )
      req.on('timeout', () => req.destroy(new SsrfError('request timeout')))
      req.on('error', reject)
      req.end()
    })

/** Default transport: the system trust store. */
export const defaultTransport: FetchTransport = createHttpsTransport()
