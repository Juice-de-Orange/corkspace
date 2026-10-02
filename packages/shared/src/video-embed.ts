/**
 * Video embed allowlist (user request): ONLY YouTube and Vimeo. Parses a share/watch URL to a
 * privacy-friendly embed URL. Everything else returns null (rendered as a normal link card). The
 * production CSP `frame-src` allows exactly these two embed hosts — nothing else can be framed.
 */
export interface VideoEmbed {
  provider: 'youtube' | 'vimeo'
  id: string
  embedUrl: string
}

export function parseVideoEmbed(raw: string): VideoEmbed | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase()

  // --- YouTube ---
  let ytId: string | null = null
  if (host === 'youtu.be') {
    ytId = u.pathname.slice(1).split('/')[0] ?? null
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    ytId = u.searchParams.get('v')
    if (!ytId) {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,})/)
      ytId = m?.[1] ?? null
    }
  }
  if (ytId && /^[A-Za-z0-9_-]{6,20}$/.test(ytId)) {
    return {
      provider: 'youtube',
      id: ytId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}`,
    }
  }

  // --- Vimeo ---
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/(?:^|\/)(\d{6,})/)
    if (m?.[1]) {
      return { provider: 'vimeo', id: m[1], embedUrl: `https://player.vimeo.com/video/${m[1]}` }
    }
  }

  return null
}
