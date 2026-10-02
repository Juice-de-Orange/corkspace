/**
 * SSRF IP classification (pure, no Node deps). Blocks image/link fetches that target non-public
 * addresses. Handles IPv4 dotted + numeric-bypass forms (decimal/hex/octal), IPv4-mapped IPv6,
 * and the key IPv6 ranges. Anything not clearly PUBLIC is treated as blocked.
 */
export type IpClass =
  | 'public'
  | 'loopback'
  | 'private'
  | 'linklocal'
  | 'cgnat'
  | 'ula'
  | 'unspecified'
  | 'multicast'
  | 'invalid'

const intToOctets = (n: number): number[] => [
  (n >>> 24) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
]

/** Parse an IPv4 in dotted (a.b.c.d) or single-number (decimal/hex/octal) form to 4 octets. */
export function parseIpv4(input: string): number[] | null {
  const s = input.trim()
  const dotted = s.split('.')
  if (dotted.length === 4 && dotted.every((p) => /^\d{1,3}$/.test(p))) {
    const nums = dotted.map((p) => Number.parseInt(p, 10))
    return nums.every((n) => n >= 0 && n <= 255) ? nums : null
  }
  let n: number | null = null
  if (/^0x[0-9a-f]+$/i.test(s)) {
    n = Number.parseInt(s, 16)
  } else if (/^0[0-7]+$/.test(s)) {
    n = Number.parseInt(s, 8)
  } else if (/^\d+$/.test(s)) {
    n = Number.parseInt(s, 10)
  }
  if (n === null || !Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    return null
  }
  return intToOctets(n)
}

function classifyIpv4(o: number[]): IpClass {
  const a = o[0] as number
  const b = o[1] as number
  if (a === 0) return 'unspecified'
  if (a === 127) return 'loopback'
  if (a === 10) return 'private'
  if (a === 172 && b >= 16 && b <= 31) return 'private'
  if (a === 192 && b === 168) return 'private'
  if (a === 169 && b === 254) return 'linklocal' // incl. 169.254.169.254 cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat'
  if (a >= 224 && a <= 239) return 'multicast'
  if (o.every((x) => x === 255)) return 'multicast'
  return 'public'
}

/** Expand an IPv6 string to 16 bytes; supports `::` and an embedded IPv4 tail. */
function ipv6ToBytes(input: string): number[] | null {
  let s = input.trim().toLowerCase()
  if (s.startsWith('[') && s.endsWith(']')) {
    s = s.slice(1, -1)
  }
  if (!s.includes(':')) {
    return null
  }

  const parts = s.split('::')
  if (parts.length > 2) {
    return null
  }
  const hasDoubleColon = parts.length === 2

  const toGroups = (part: string | undefined): string[] | null => {
    if (!part) {
      return []
    }
    const segs = part.split(':')
    const groups: string[] = []
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i] as string
      if (seg.includes('.')) {
        if (i !== segs.length - 1) {
          return null // embedded IPv4 only allowed as the final segment
        }
        const v4 = parseIpv4(seg)
        if (!v4) {
          return null
        }
        groups.push(
          (((v4[0] as number) << 8) | (v4[1] as number)).toString(16),
          (((v4[2] as number) << 8) | (v4[3] as number)).toString(16),
        )
      } else if (/^[0-9a-f]{1,4}$/.test(seg)) {
        groups.push(seg)
      } else {
        return null
      }
    }
    return groups
  }

  const head = toGroups(parts[0])
  const back = hasDoubleColon ? toGroups(parts[1]) : []
  if (head === null || back === null) {
    return null
  }
  const fill = 8 - head.length - back.length
  if (hasDoubleColon ? fill < 0 : fill !== 0) {
    return null
  }
  const groups = hasDoubleColon ? [...head, ...Array(fill).fill('0'), ...back] : head
  if (groups.length !== 8) {
    return null
  }

  const bytes: number[] = []
  for (const g of groups) {
    const v = Number.parseInt(g, 16)
    bytes.push((v >> 8) & 255, v & 255)
  }
  return bytes
}

function classifyIpv6(b: number[]): IpClass {
  if (b.every((x) => x === 0)) {
    return 'unspecified'
  }
  if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) {
    return 'loopback'
  }
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) {
    return classifyIpv4(b.slice(12)) // IPv4-mapped ::ffff:a.b.c.d
  }
  const first = b[0] as number
  if ((first & 0xfe) === 0xfc) return 'ula' // fc00::/7
  if (first === 0xfe && ((b[1] as number) & 0xc0) === 0x80) return 'linklocal' // fe80::/10
  if (first === 0xff) return 'multicast'
  return 'public'
}

/** Classify an IP literal (IPv4 any form, or IPv6). */
export function classifyIp(ip: string): IpClass {
  const v4 = parseIpv4(ip)
  if (v4) {
    return classifyIpv4(v4)
  }
  const v6 = ipv6ToBytes(ip)
  if (v6) {
    return classifyIpv6(v6)
  }
  return 'invalid'
}

/** True for any address that must NOT be fetched (anything not clearly public). */
export function isBlockedIp(ip: string): boolean {
  return classifyIp(ip) !== 'public'
}
