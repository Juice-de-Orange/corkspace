import type { FeedbackKind } from '@corkspace/shared'
import { useEffect, useState } from 'react'
import { apiSubmitFeedback } from '../api/feedback'
import { captureViewportJpeg } from '../canvas/export/export-viewport'
import { useT } from '../i18n'

type Phase = 'idle' | 'capturing' | 'form' | 'sending' | 'done'

/**
 * Feedback button (header): report a bug or an improvement wish, optionally with a screenshot of
 * the current board view. Available to every signed-in user. The screenshot is captured the moment
 * the dialog opens (before the dialog covers anything), so it shows the actual board.
 */
export function FeedbackButton() {
  const t = useT()
  const [phase, setPhase] = useState<Phase>('idle')
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [message, setMessage] = useState('')
  const [attach, setAttach] = useState(true)
  const [shot, setShot] = useState<string | null>(null)

  const open = async (): Promise<void> => {
    setPhase('capturing')
    setKind('bug')
    setMessage('')
    setAttach(true)
    const dataUrl = await captureViewportJpeg(0.7).catch(() => null)
    setShot(dataUrl)
    setPhase('form')
  }

  const close = (): void => {
    setPhase('idle')
    setShot(null)
  }

  // Close on Escape while the dialog is open (avoids interactive handlers on the backdrop div).
  const dialogOpen = phase !== 'idle' && phase !== 'capturing'
  useEffect(() => {
    if (!dialogOpen) {
      return
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setPhase('idle') // close (inlined; stable setters keep the effect deps minimal)
        setShot(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogOpen])

  const submit = async (): Promise<void> => {
    if (!message.trim()) {
      return
    }
    setPhase('sending')
    try {
      await apiSubmitFeedback({
        kind,
        message: message.trim(),
        context:
          `${location.href} · ${window.innerWidth}x${window.innerHeight} · ${navigator.userAgent}`.slice(
            0,
            2000,
          ),
        ...(attach && shot ? { screenshot: shot } : {}),
      })
      setPhase('done')
      setTimeout(close, 1600)
    } catch {
      setPhase('form') // let them retry
    }
  }

  const kindBtn = (k: FeedbackKind, label: string): React.ReactNode => (
    <button
      type="button"
      data-feedback-kind={k}
      aria-pressed={kind === k}
      onClick={() => setKind(k)}
      className={kind === k ? 'btn is-active' : 'btn btn-ghost'}
      style={{ flex: 1 }}
    >
      {label}
    </button>
  )

  return (
    <>
      <button
        type="button"
        data-feedback-toggle
        disabled={phase === 'capturing'}
        onClick={() => void open()}
        className="btn btn-ghost"
        title={t('forms.feedbackTitle')}
      >
        💬 {t('forms.feedback')}
      </button>
      {phase !== 'idle' && phase !== 'capturing' && (
        <div
          data-feedback-modal
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 4_000_000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="panel"
            style={{
              width: 'min(440px, 92vw)',
              maxHeight: '88vh',
              overflow: 'auto',
              background: 'var(--panel-solid)',
              padding: 16,
              textAlign: 'left',
            }}
          >
            {phase === 'done' ? (
              <div data-feedback-done style={{ padding: '12px 0', fontSize: 15 }}>
                ✅ {t('forms.feedbackThanks')}
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
                  {t('forms.feedback')}
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {kindBtn('bug', `🐞 ${t('forms.kindBug')}`)}
                  {kindBtn('wish', `💡 ${t('forms.kindWish')}`)}
                </div>
                <textarea
                  data-feedback-message
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    kind === 'bug' ? t('forms.placeholderBug') : t('forms.placeholderWish')
                  }
                  rows={4}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 8,
                    borderRadius: 6,
                    border: '1px solid var(--panel-border)',
                    background: 'var(--app-bg)',
                    color: 'var(--app-text)',
                    fontSize: 14,
                    resize: 'vertical',
                  }}
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    margin: '10px 0',
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    data-feedback-attach
                    checked={attach}
                    disabled={!shot}
                    onChange={(e) => setAttach(e.target.checked)}
                  />
                  {t('forms.attachScreenshot')} {shot ? '' : t('forms.notAvailable')}
                </label>
                {attach && shot && (
                  <img
                    data-feedback-preview
                    src={shot}
                    alt={t('forms.screenshotPreview')}
                    style={{
                      width: '100%',
                      borderRadius: 6,
                      border: '1px solid var(--panel-border)',
                      marginBottom: 10,
                    }}
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={close} className="btn btn-ghost">
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    data-feedback-submit
                    disabled={!message.trim() || phase === 'sending'}
                    onClick={() => void submit()}
                    className="btn btn-accent"
                  >
                    {phase === 'sending' ? t('forms.sending') : t('forms.send')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
