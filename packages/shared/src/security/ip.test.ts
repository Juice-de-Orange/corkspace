import { describe, expect, it } from 'vitest'
import { classifyIp, isBlockedIp, parseIpv4 } from './ip'

describe('parseIpv4 (incl. numeric-bypass forms)', () => {
  it('parses dotted, decimal, hex and octal', () => {
    expect(parseIpv4('127.0.0.1')).toEqual([127, 0, 0, 1])
    expect(parseIpv4('2130706433')).toEqual([127, 0, 0, 1]) // decimal
    expect(parseIpv4('0x7f000001')).toEqual([127, 0, 0, 1]) // hex
    expect(parseIpv4('017700000001')).toEqual([127, 0, 0, 1]) // octal
  })

  it('rejects out-of-range and non-IPv4', () => {
    expect(parseIpv4('256.0.0.1')).toBeNull()
    expect(parseIpv4('example.com')).toBeNull()
    expect(parseIpv4('99999999999')).toBeNull()
  })
})

describe('classifyIp', () => {
  it('classifies public IPv4', () => {
    expect(classifyIp('8.8.8.8')).toBe('public')
    expect(classifyIp('1.1.1.1')).toBe('public')
  })

  it('classifies loopback in every IPv4 form', () => {
    for (const ip of ['127.0.0.1', '127.5.5.5', '2130706433', '0x7f000001']) {
      expect(classifyIp(ip)).toBe('loopback')
    }
  })

  it('classifies private ranges', () => {
    expect(classifyIp('10.0.0.5')).toBe('private')
    expect(classifyIp('172.16.0.1')).toBe('private')
    expect(classifyIp('172.31.255.255')).toBe('private')
    expect(classifyIp('172.32.0.1')).toBe('public')
    expect(classifyIp('192.168.1.1')).toBe('private')
  })

  it('classifies link-local incl. cloud metadata, cgnat, unspecified, multicast', () => {
    expect(classifyIp('169.254.10.20')).toBe('linklocal')
    expect(classifyIp('169.254.169.254')).toBe('linklocal') // AWS/GCP metadata
    expect(classifyIp('100.64.0.1')).toBe('cgnat')
    expect(classifyIp('0.0.0.0')).toBe('unspecified')
    expect(classifyIp('224.0.0.1')).toBe('multicast')
    expect(classifyIp('255.255.255.255')).toBe('multicast')
  })

  it('classifies IPv6 ranges', () => {
    expect(classifyIp('::1')).toBe('loopback')
    expect(classifyIp('::')).toBe('unspecified')
    expect(classifyIp('fc00::1')).toBe('ula')
    expect(classifyIp('fd12:3456::1')).toBe('ula')
    expect(classifyIp('fe80::1')).toBe('linklocal')
    expect(classifyIp('ff02::1')).toBe('multicast')
    expect(classifyIp('2606:4700:4700::1111')).toBe('public')
    expect(classifyIp('[2606:4700::1111]')).toBe('public')
  })

  it('resolves IPv4-mapped IPv6 to the embedded IPv4 class', () => {
    expect(classifyIp('::ffff:127.0.0.1')).toBe('loopback')
    expect(classifyIp('::ffff:8.8.8.8')).toBe('public')
    expect(classifyIp('::ffff:169.254.169.254')).toBe('linklocal')
  })

  it('marks garbage and malformed IPv6 as invalid', () => {
    expect(classifyIp('not-an-ip')).toBe('invalid')
    expect(classifyIp('1.2.3')).toBe('invalid')
    expect(classifyIp('gggg::1')).toBe('invalid')
    expect(classifyIp('fe80::1::2')).toBe('invalid') // multiple '::'
    expect(classifyIp('1:2:3:4:5:6:7:8:9')).toBe('invalid') // too many groups
    expect(classifyIp('1:2:3:4:5:6:7')).toBe('invalid') // too few, no '::'
    expect(classifyIp('::ffff:1.2.3')).toBe('invalid') // bad embedded IPv4
    expect(classifyIp('::1.2.3.4.5')).toBe('invalid') // embedded IPv4 not final/oversized
  })
})

describe('isBlockedIp', () => {
  it('allows only clearly-public addresses', () => {
    expect(isBlockedIp('8.8.8.8')).toBe(false)
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false)
  })
  it('blocks loopback/private/linklocal/metadata/ula/invalid', () => {
    for (const ip of [
      '127.0.0.1',
      '2130706433',
      '10.1.2.3',
      '192.168.0.1',
      '169.254.169.254',
      '::1',
      'fc00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      'garbage',
    ]) {
      expect(isBlockedIp(ip)).toBe(true)
    }
  })
})
