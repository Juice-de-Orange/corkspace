import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import type { Extensions } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import DOMPurify from 'dompurify'
import { LinkEmbed } from './link-embed'

/** Curated document extension set, shared by the live editor and static HTML preview so they
 *  render identically. `entry:` links are internal jumps (handled in the preview, no thread);
 *  `linkEmbed` is an inline link-preview card. (Tables + code highlighting are a later enrichment.) */
export const docExtensions: Extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  Link.configure({ openOnClick: false, autolink: true, protocols: ['entry'] }),
  Highlight,
  TextStyle,
  Color,
  Typography,
  LinkEmbed,
]

export const EMPTY_DOC: Record<string, unknown> = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

// DOMPurify's default allowed-scheme regexp, extended with the internal `entry:` scheme so
// internal-jump links survive sanitization (everything else stays at the safe default).
const ALLOWED_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|entry):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i

/** Sanitize rendered document HTML (keeps `target`/`rel` and the internal `entry:` scheme). */
export function sanitizeDocHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
    ALLOWED_URI_REGEXP,
  })
}
