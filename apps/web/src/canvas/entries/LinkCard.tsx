import { parseVideoEmbed } from '@corkspace/shared'
import { type Ref, useEffect, useState } from 'react'
import { assetUrl } from '../../api/assets'
import { apiGetContent } from '../../api/entries'
import { useT } from '../../i18n'
import type { EntryMeta } from '../state/entry-store'

interface LinkContent {
  url?: string
  title?: string
  description?: string
  siteName?: string
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** Pinnable link card: shows the OG preview (image/title/description/site). The title is a link;
 *  the rest of the card is draggable. */
export function LinkCard({ meta, innerRef }: { meta: EntryMeta; innerRef: Ref<HTMLDivElement> }) {
  const [content, setContent] = useState<LinkContent>({})
  const t = useT()

  useEffect(() => {
    let cancelled = false
    void apiGetContent(meta.id)
      .then((c) => {
        if (!cancelled && c && typeof c === 'object') {
          setContent(c as LinkContent)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [meta.id])

  const url = content.url ?? ''
  const video = url ? parseVideoEmbed(url) : null

  return (
    <div
      ref={innerRef}
      data-entry-id={meta.id}
      className="entry entry-link"
      style={{
        position: 'absolute',
        left: meta.x,
        top: meta.y,
        width: meta.w,
        height: meta.h,
        transform: `rotate(${meta.rotation}deg)`,
        zIndex: meta.zIndex,
        overflow: 'hidden',
        display: video ? 'block' : 'flex',
        boxSizing: 'border-box',
      }}
    >
      {video ? (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
          {/* Drag surface (the iframe below captures pointer events for playback). */}
          <div
            style={{
              height: 24,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 8px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--panel-text)',
              cursor: 'move',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            <span>▶ {video.provider === 'youtube' ? 'YouTube' : 'Vimeo'}</span>
            <span
              style={{ color: 'var(--panel-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {content.title ?? ''}
            </span>
          </div>
          <iframe
            src={video.embedUrl}
            title={content.title ?? t('canvas.video')}
            data-no-pan
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="fullscreen; encrypted-media; picture-in-picture"
            style={{ flex: 1, width: '100%', border: 0, display: 'block' }}
          />
        </div>
      ) : (
        <>
          {meta.imageAssetId && (
            <img
              src={assetUrl(meta.imageAssetId)}
              alt=""
              draggable={false}
              style={{ width: 88, height: '100%', objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div style={{ padding: 8, overflow: 'hidden', minWidth: 0 }}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              data-no-pan
              // No native link drag: it would cancel the pointer and fight the card's own drag.
              draggable={false}
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: 'var(--link-fs, 26px)',
                color: 'var(--panel-text)',
                textDecoration: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {content.title ?? url}
            </a>
            {content.description && (
              <div
                style={{
                  fontSize: 20,
                  color: 'var(--panel-muted)',
                  marginTop: 3,
                  maxHeight: 44,
                  overflow: 'hidden',
                }}
              >
                {content.description}
              </div>
            )}
            <div style={{ fontSize: 18, color: 'var(--panel-muted)', marginTop: 4 }}>
              {content.siteName ?? hostOf(url)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
