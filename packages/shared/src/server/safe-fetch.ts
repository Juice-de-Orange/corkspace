import { classifyIp, isBlockedIp } from '../security/ip'

/** Thrown for any SSRF-unsafe or disallowed fetch. */
export class SsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfError'
  }
}

export interface ResolvedOptions {
  maxBytes: number
  timeoutMs: number
  maxRedirects: number
  allowedContentTypes?: string[] | undefined
  userAgent: string
}

export interface FetchResponse {
  status: number
  location: string | null
  contentType: string
  /** Read the body, aborting (SsrfError) if it exceeds `maxBytes`. */
  readBody: (maxBytes: number) => Promise<Buffer>
  /** Abort/cleanup the in-flight request. */
  cancel: () => void
}

/** Resolve a hostname to candidate IP strings. */
export type Resolver = (hostname: string) => Promise<string[]>
/** Perform one request to `url`, with the socket pinned to `pinnedIp`. */
export type FetchTransport = (
  url: URL,
  pinnedIp: string,
  opts: ResolvedOptions,
) => Promise<FetchResponse>

export interface SafeFetchOptions {
  maxBytes?: number
  timeoutMs?: number
  maxRedirects?: number
  allowedContentTypes?: string[]
  userAgent?: string
}

export interface SafeFetchResult {
  finalUrl: string
  contentType: string
  body: Buffer
}

export function assertHttps(url: URL): void {
  if (url.protocol !== 'https:') {
    throw new SsrfError(`only https is allowed (got ${url.protocol || 'no protocol'})`)
  }
}

/**
 * Return the single IP to connect to, having validated EVERY candidate. IP-literal hosts are
 * checked directly; hostnames are resolved and every address must be public (defeats a record
 * set that mixes a public + a private address). The returned IP is what the transport pins to,
 * defeating DNS-rebinding between validation and connect.
 */
export async function resolvePinnedIp(hostname: string, resolver: Resolver): Promise<string> {
  if (classifyIp(hostname) !== 'invalid') {
    if (isBlockedIp(hostname)) {
      throw new SsrfError(`blocked address: ${hostname}`)
    }
    return hostname
  }
  const ips = await resolver(hostname)
  if (ips.length === 0) {
    throw new SsrfError(`no DNS records for ${hostname}`)
  }
  for (const ip of ips) {
    if (isBlockedIp(ip)) {
      throw new SsrfError(`blocked resolved address ${ip} for ${hostname}`)
    }
  }
  return ips[0] as string
}

/**
 * Build an SSRF-safe fetcher from an injectable resolver + transport. The redirect loop
 * re-validates EACH hop (so a public URL cannot redirect to an internal one).
 */
export function createSafeFetch(deps: { resolver: Resolver; transport: FetchTransport }) {
  return async function safeFetch(
    rawUrl: string,
    options: SafeFetchOptions = {},
  ): Promise<SafeFetchResult> {
    const opts: ResolvedOptions = {
      maxBytes: options.maxBytes ?? 8 * 1024 * 1024,
      timeoutMs: options.timeoutMs ?? 8000,
      maxRedirects: options.maxRedirects ?? 3,
      allowedContentTypes: options.allowedContentTypes,
      userAgent:
        options.userAgent ?? 'CorkspaceBot/1.0 (+https://github.com/Juice-de-Orange/corkspace)',
    }

    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      throw new SsrfError(`invalid URL: ${rawUrl}`)
    }

    let redirects = 0
    for (;;) {
      assertHttps(url)
      const pinnedIp = await resolvePinnedIp(url.hostname, deps.resolver)
      const res = await deps.transport(url, pinnedIp, opts)

      if (res.status >= 300 && res.status < 400 && res.location) {
        res.cancel()
        if (++redirects > opts.maxRedirects) {
          throw new SsrfError('too many redirects')
        }
        try {
          url = new URL(res.location, url)
        } catch {
          throw new SsrfError(`invalid redirect location: ${res.location}`)
        }
        continue
      }

      if (res.status < 200 || res.status >= 300) {
        res.cancel()
        throw new SsrfError(`unexpected status ${res.status}`)
      }

      if (
        opts.allowedContentTypes &&
        !opts.allowedContentTypes.some((p) => res.contentType.startsWith(p))
      ) {
        res.cancel()
        throw new SsrfError(`disallowed content-type: ${res.contentType || '(none)'}`)
      }

      const body = await res.readBody(opts.maxBytes)
      return { finalUrl: url.toString(), contentType: res.contentType, body }
    }
  }
}
