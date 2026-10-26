'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  users: { id: string; fullName: string }[]
}

const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function TaskForm({ projectId, users }: Props) {
  const router = useRouter()
  // "Hôm nay" theo giờ Việt Nam (toISOString là giờ UTC, lệch ngày trước 7h sáng)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [dueDate, setDueDate] = useState(today)
  const [priority, setPriority] = useState('NORMAL')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          description: description || undefined,
          ownerId: ownerId || null,
          startDate,
          dueDate,
          priority,
        }),
      })
      if (res.status === 401) {
        window.location.href = '/dang-nhap?error=session'
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Không lưu được')
      router.push(`/du-an/${projectId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg space-y-4">
      <div>
        <label htmlFor="t-title" className="block text-sm font-medium mb-1">Tên việc</label>
        <input id="t-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </div>
      <div>
        <label htmlFor="t-desc" className="block text-sm font-medium mb-1">Mô tả (không bắt buộc)</label>
        <textarea id="t-desc" rows={3} className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label htmlFor="t-owner" className="block text-sm font-medium mb-1">Người phụ trách</label>
        <select id="t-owner" className={input} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          <option value="">— Chưa giao —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="t-start" className="block text-sm font-medium mb-1">Bắt đầu</label>
          <input id="t-start" type="date" className={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="t-due" className="block text-sm font-medium mb-1">Hạn hoàn thành</label>
          <input id="t-due" type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="t-priority" className="block text-sm font-medium mb-1">Ưu tiên</label>
          <select id="t-priority" className={input} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="LOW">Thấp</option>
            <option value="NORMAL">Bình thường</option>
            <option value="HIGH">Cao</option>
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg">
        {saving ? 'Đang lưu…' : 'Tạo việc'}
      </button>
    </form>
  )
}
