import { mergeAttributes, Node } from '@tiptap/core'

/**
 * Inline link-preview embed: an atom block node that renders a link card (title + url +
 * description) inside a document. The preview metadata is fetched via the SSRF-safe
 * `/api/links/preview` endpoint at insert time and stored on the node's attributes, so the
 * static `generateHTML` preview renders identically (and a failing fetch never breaks the doc).
 */
export const LinkEmbed = Node.create({
  name: 'linkEmbed',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (el) => el.getAttribute('href') ?? '',
        renderHTML: (attrs) => ({ href: attrs.url }),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') ?? '',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
      description: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-description') ?? '',
        renderHTML: (attrs) => ({ 'data-description': attrs.description }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-link-embed]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const title = (node.attrs.title as string) || (node.attrs.url as string)
    const desc = node.attrs.description as string
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-link-embed': '',
        class: 'link-embed',
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
      ['span', { class: 'link-embed-title' }, title],
      ['span', { class: 'link-embed-url' }, node.attrs.url as string],
      ...(desc ? [['span', { class: 'link-embed-desc' }, desc] as const] : []),
    ]
  },
})
