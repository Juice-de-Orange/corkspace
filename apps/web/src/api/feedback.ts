import type { CreateFeedbackInput, FeedbackStatus } from '@corkspace/shared'

export interface FeedbackListItem {
  id: string
  kind: 'bug' | 'wish'
  message: string
  context: string | null
  status: FeedbackStatus
  createdAt: string
  hasScreenshot: boolean
}

export interface FeedbackDetail extends Omit<FeedbackListItem, 'hasScreenshot'> {
  screenshot: string | null
}

export async function apiSubmitFeedback(input: CreateFeedbackInput): Promise<void> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw new Error(`feedback failed: ${res.status}`)
  }
}

export async function apiListFeedback(): Promise<FeedbackListItem[]> {
  const res = await fetch('/api/feedback', { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`feedback list failed: ${res.status}`)
  }
  return res.json() as Promise<FeedbackListItem[]>
}

export async function apiGetFeedback(id: string): Promise<FeedbackDetail> {
  const res = await fetch(`/api/feedback/${id}`, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`feedback detail failed: ${res.status}`)
  }
  return res.json() as Promise<FeedbackDetail>
}

export async function apiSetFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  const res = await fetch(`/api/feedback/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    throw new Error(`feedback status failed: ${res.status}`)
  }
}

export async function apiDeleteFeedback(id: string): Promise<void> {
  const res = await fetch(`/api/feedback/${id}`, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) {
    throw new Error(`feedback delete failed: ${res.status}`)
  }
}
