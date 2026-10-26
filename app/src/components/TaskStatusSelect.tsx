'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const OPTIONS = [
  { value: 'TODO', label: 'Chưa làm' },
  { value: 'DOING', label: 'Đang làm' },
  { value: 'DONE', label: 'Hoàn thành' },
] as const

export default function TaskStatusSelect({
  taskId,
  taskTitle,
  status,
  canEdit,
}: {
  taskId: string
  taskTitle: string
  status: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function change(next: string) {
    const prev = value
    setValue(next)
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.status === 401) {
        window.location.href = '/dang-nhap?error=session'
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Không lưu được')
      }
      router.refresh()
    } catch (e) {
      setValue(prev)
      setError(e instanceof Error ? e.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    return <span className="text-xs text-gray-600">{OPTIONS.find((o) => o.value === value)?.label}</span>
  }

  return (
    <span className="inline-flex flex-col items-end">
      <select
        aria-label={`Trạng thái: ${taskTitle}`}
        value={value}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs text-red-600 mt-1">
          {error}
        </span>
      )}
    </span>
  )
}
