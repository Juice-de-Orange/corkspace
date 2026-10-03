import { cameraForRect } from '@corkspace/engine'
import { screenSize } from '@corkspace/shared'
import { generateHTML } from '@tiptap/html'
import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import { type Ref, useEffect, useMemo, useRef, useState } from 'react'
import { computed } from 'signia'
import { useValue } from 'signia-react'
import { apiGetContent } from '../../api/entries'
import { apiLinkPreview } from '../../api/links'
import { updateEntryContentCommand } from '../../commands/entry-commands'
import { docExtensions, EMPTY_DOC, sanitizeDocHtml } from '../../editor/extensions'
import { history } from '../../history/history'
import { dateLocale, useT } from '../../i18n'
import { flyTo } from '../runtime/fly-to'
import { viewportAtom } from '../state/camera-store'
import { editingEntryIdAtom, setEditing } from '../state/editor-state'
import {
  type EntryMeta,
  entriesAtom,
  entryContentRevAtom,
  recentlyCreatedIds,
} from '../state/entry-store'
import { clipboardIdAtom } from '../state/selection-state'

type Json = Record<string, unknown>

/** Fly the board camera to another entry (internal-link jump; no visible thread). */
function jumpToEntry(id: string): void {
  const meta = entriesAtom.value.get(id)
  if (!meta) {
    return
  }
  const vp = viewportAtom.value
  flyTo(cameraForRect({ x: meta.x, y: meta.y, w: meta.w, h: meta.h }, screenSize(vp.w, vp.h)))
}

function readDoc(content: unknown): Json {
  if (content && typeof content === 'object') {
    const d = (content as { doc?: unknown }).doc
    if (d && typeof d === 'object') {
      return d as Json
    }
  }
  return EMPTY_DOC
}

function DocPreview({ doc }: { doc: Json }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = useMemo(() => {
    try {
      return sanitizeDocHtml(generateHTML(doc, docExtensions))
    } catch {
      return ''
    }
  }, [doc])
  // Delegate clicks on internal `entry:` links to a board flight (native listener, not a JSX
  // onClick — keeps this static-HTML container free of interactive-element a11y warnings).
  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const onClick = (e: MouseEvent): void => {
      const anchor = (e.target as HTMLElement | null)?.closest('a')
      const href = anchor?.getAttribute('href')
      if (href?.startsWith('entry:')) {
        e.preventDefault()
        jumpToEntry(href.slice('entry:'.length))
      }
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [])
  return (
    <div
      ref={ref}
      className="doc-preview"
      style={{
        fontFamily: 'var(--doc-font, "Source Serif 4", Georgia, serif)',
        fontSize: 'var(--doc-fs, 30px)',
        lineHeight: 1.4,
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized by sanitizeDocHtml
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ToolButton({
  active,
  onRun,
  label,
  title,
}: {
  active: boolean
  onRun: () => void
  label: string
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className={active ? 'btn btn-sm is-active' : 'btn btn-sm btn-ghost'}
    >
      {label}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useT()
  // NOTE: this toolbar uses native window.prompt/alert, not the themed useDialogs modal: the modal
  // steals focus from the ProseMirror editor, whose blur handler commits + UNMOUNTS the editor
  // (single-live-editor invariant), leaving a stale `editor` ref that can't insert. Native prompts
  // don't move DOM focus that way, so they're the correct fit inside the live editor.
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 4, flexWrap: 'wrap' }}>
      <ToolButton
        active={editor.isActive('bold')}
        label="B"
        onRun={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        active={editor.isActive('italic')}
        label="I"
        onRun={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        active={editor.isActive('underline')}
        label="U"
        onRun={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        active={editor.isActive('strike')}
        label="S"
        title={t('canvas.strikethrough')}
        onRun={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolButton
        active={editor.isActive('heading', { level: 1 })}
        label="H1"
        onRun={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolButton
        active={editor.isActive('heading', { level: 2 })}
        label="H2"
        onRun={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        active={editor.isActive('bulletList')}
        label="•"
        onRun={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        active={editor.isActive('orderedList')}
        label="1."
        title={t('canvas.orderedList')}
        onRun={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton
        active={editor.isActive('codeBlock')}
        label="</>"
        onRun={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolButton
        active={editor.isActive('blockquote')}
        label="❝"
        onRun={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton
        active={false}
        label="🕒"
        onRun={() => {
          const now = new Date().toLocaleString(dateLocale(), {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
          editor.chain().focus().insertContent(now).run()
        }}
      />
      <ToolButton
        active={editor.isActive('link')}
        label="🔗"
        onRun={() => {
          const id = clipboardIdAtom.value
          if (!id) {
            window.alert(t('canvas.copyEntryFirst'))
            return
          }
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'text',
              text: t('canvas.linkedEntryText'),
              marks: [{ type: 'link', attrs: { href: `entry:${id}` } }],
            })
            .run()
        }}
      />
      <ToolButton
        active={false}
        label="🌐"
        onRun={() => {
          const url = window.prompt(t('canvas.embedLinkUrl'))
          if (!url) {
            return
          }
          const insert = (attrs: { url: string; title: string; description: string }): void => {
            editor.chain().focus().insertContent({ type: 'linkEmbed', attrs }).run()
          }
          void apiLinkPreview(url)
            .then((p) =>
              insert({ url: p.url, title: p.title ?? p.url, description: p.description ?? '' }),
            )
            .catch(() => insert({ url, title: url, description: '' }))
        }}
      />
    </div>
  )
}

function DocEditor({ initial, onCommit }: { initial: Json; onCommit: (json: Json) => void }) {
  const editor = useEditor({
    extensions: docExtensions,
    content: initial,
    autofocus: 'end',
    // tiptap 3 no longer re-renders on every transaction; the toolbar's active states rely on it.
    shouldRerenderOnTransaction: true,
  })
  // Stable handler: bind blur ONCE per editor (a fresh onCommit each render must not re-bind).
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  useEffect(() => {
    if (!editor) {
      return
    }
    const handler = () => commitRef.current(editor.getJSON() as Json)
    editor.on('blur', handler)
    return () => {
      editor.off('blur', handler)
    }
  }, [editor])

  if (!editor) {
    return null
  }
  return (
    <div data-no-pan style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="doc-editor" />
    </div>
  )
}

/**
 * Rich document entry. Double-click mounts exactly one live TipTap editor (single-editor
 * invariant via editingEntryIdAtom); blur serializes the doc → autosave + version → unmount,
 * back to the sanitized static preview.
 */
export function DocEntry({ meta, innerRef }: { meta: EntryMeta; innerRef: Ref<HTMLDivElement> }) {
  const editing = useValue(editingEntryIdAtom) === meta.id
  const [doc, setDoc] = useState<Json>(EMPTY_DOC)
  const [loaded, setLoaded] = useState(() => recentlyCreatedIds.has(meta.id))
  const editingRef = useRef(editing)
  editingRef.current = editing
  const docRef = useRef(doc)
  docRef.current = doc
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded
  const lastSavedRef = useRef('')
  const contentRev = useValue(
    useMemo(
      () => computed(`contentRev:${meta.id}`, () => entryContentRevAtom.value.get(meta.id) ?? 0),
      [meta.id],
    ),
  )

  useEffect(() => {
    let cancelled = false
    void apiGetContent(meta.id, contentRev)
      .then((c) => {
        if (cancelled) {
          return
        }
        const d = readDoc(c)
        if (!editingRef.current) {
          setDoc(d)
          lastSavedRef.current = JSON.stringify(d)
        }
        setLoaded(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [meta.id, contentRev])

  function commit(json: Json): void {
    setEditing(null)
    // Content-wipe guard + dirty check (the latter also blocks the double blur on editor teardown).
    if (!loadedRef.current) {
      return
    }
    const s = JSON.stringify(json)
    if (s === lastSavedRef.current) {
      return
    }
    const prev = docRef.current
    lastSavedRef.current = s
    setDoc(json)
    void history.execute(updateEntryContentCommand(meta.id, { doc: prev }, { doc: json }))
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: canvas entry; full a11y in Phase 6
    <div
      ref={innerRef}
      data-entry-id={meta.id}
      className={`entry entry-doc${
        meta.color === 'lined' ? ' doc-paper-lined' : meta.color === 'grid' ? ' doc-paper-grid' : ''
      }`}
      onDoubleClick={() => loaded && setEditing(meta.id)}
      style={{
        position: 'absolute',
        left: meta.x,
        top: meta.y,
        width: meta.w,
        height: meta.h,
        transform: `rotate(${meta.rotation}deg)`,
        zIndex: meta.zIndex,
        padding: 12,
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      {editing ? <DocEditor initial={doc} onCommit={commit} /> : <DocPreview doc={doc} />}
    </div>
  )
}
