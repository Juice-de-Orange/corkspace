import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:https'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHttpsTransport, defaultResolver, pinnedLookup } from './https-transport'
import { createSafeFetch, type ResolvedOptions, SsrfError } from './safe-fetch'

// A name that exists in no DNS zone (.test is reserved): a request for it can only arrive at the
// local server if the socket really connects to the pinned IP instead of resolving the name.
const HOST = 'pinned.test'

const opts: ResolvedOptions = {
  maxBytes: 1024,
  timeoutMs: 5000,
  maxRedirects: 0,
  userAgent: 'test',
}

describe('pinnedLookup', () => {
  it('answers with a single address when asked for one', () => {
    let got: unknown[] = []
    pinnedLookup('203.0.113.7')('ignored.example', {}, (...args) => {
      got = args
    })
    expect(got).toEqual([null, '203.0.113.7', 4])
  })

  it('answers with a list when asked for all addresses (node >= 20 connect path)', () => {
    let got: unknown[] = []
    pinnedLookup('2001:db8::7')('ignored.example', { all: true }, (...args) => {
      got = args
    })
    expect(got).toEqual([null, [{ address: '2001:db8::7', family: 6 }]])
  })
})

describe('https transport (real sockets, local TLS server)', () => {
  let dir: string
  let server: Server
  let port: number
  let ca: Buffer
  const seen: { host: string | undefined; url: string | undefined }[] = []

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'corkspace-tls-'))
    const key = path.join(dir, 'key.pem')
    const cert = path.join(dir, 'cert.pem')
    // Throwaway self-signed certificate for HOST, generated per run (nothing is checked in).
    execFileSync(
      'openssl',
      [
        ...['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes'],
        ...['-days', '1', '-subj', `/CN=${HOST}`, '-addext', `subjectAltName=DNS:${HOST}`],
        ...['-keyout', key, '-out', cert],
      ],
      { stdio: 'ignore' },
    )
    ca = readFileSync(cert)
    server = createServer({ key: readFileSync(key), cert: ca }, (req, res) => {
      seen.push({ host: req.headers.host, url: req.url })
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<title>pinned</title>')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  })

  it('connects to the pinned IP, not to whatever the hostname resolves to', async () => {
    const transport = createHttpsTransport({ ca })
    const res = await transport(new URL(`https://${HOST}:${port}/page?q=1`), '127.0.0.1', opts)
    expect(res.status).toBe(200)
    expect(res.contentType).toBe('text/html')
    expect((await res.readBody(opts.maxBytes)).toString('utf8')).toBe('<title>pinned</title>')
    expect(seen.at(-1)).toEqual({ host: `${HOST}:${port}`, url: '/page?q=1' })
  })

  it('still verifies the certificate against the hostname', async () => {
    const transport = createHttpsTransport({ ca })
    await expect(
      transport(new URL(`https://other.test:${port}/`), '127.0.0.1', opts),
    ).rejects.toMatchObject({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' })
  })

  it('refuses a hostname that resolves to loopback before any connection is made', async () => {
    const before = seen.length
    const safeFetch = createSafeFetch({
      resolver: async () => ['127.0.0.1'],
      transport: createHttpsTransport({ ca }),
    })
    await expect(safeFetch(`https://${HOST}:${port}/`)).rejects.toThrow(SsrfError)
    await expect(safeFetch(`https://${HOST}:${port}/`)).rejects.toThrow(/blocked resolved address/)
    expect(seen.length).toBe(before)
  })

  it('refuses private and loopback targets through the real resolver too', async () => {
    const before = seen.length
    const safeFetch = createSafeFetch({
      resolver: defaultResolver,
      transport: createHttpsTransport({ ca }),
    })
    await expect(safeFetch(`https://localhost:${port}/`)).rejects.toThrow(/blocked/)
    await expect(safeFetch(`https://127.0.0.1:${port}/`)).rejects.toThrow(/blocked address/)
    await expect(safeFetch(`https://10.0.0.5:${port}/`)).rejects.toThrow(/blocked address/)
    expect(seen.length).toBe(before)
  })
})
