'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  mode: 'create' | 'edit'
  departments: { id: string; name: string }[]
  initial?: { id: string; name: string; departmentId: string; startDate: string; endDate: string }
}

const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function ProjectForm({ mode, departments, initial }: Props) {
  const router = useRouter()
  // "Hôm nay" theo giờ Việt Nam (toISOString là giờ UTC, lệch ngày trước 7h sáng)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  const [name, setName] = useState(initial?.name ?? '')
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? (departments.length === 1 ? departments[0].id : ''))
  const [startDate, setStartDate] = useState(initial?.startDate ?? today)
  const [endDate, setEndDate] = useState(initial?.endDate ?? today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(mode === 'create' ? '/api/projects' : `/api/projects/${initial!.id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'create' ? { name, departmentId, startDate, endDate } : { name, startDate, endDate }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Không lưu được')
      router.push(`/du-an/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg space-y-4">
      <div>
        <label htmlFor="p-name" className="block text-sm font-medium mb-1">Tên dự án</label>
        <input id="p-name" className={input} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </div>
      {mode === 'create' && (
        <div>
          <label htmlFor="p-dept" className="block text-sm font-medium mb-1">Bộ phận</label>
          <select id="p-dept" className={input} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
            <option value="">— Chọn bộ phận —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="p-start" className="block text-sm font-medium mb-1">Ngày bắt đầu</label>
          <input id="p-start" type="date" className={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="p-end" className="block text-sm font-medium mb-1">Ngày kết thúc</label>
          <input id="p-end" type="date" className={input} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg">
        {saving ? 'Đang lưu…' : mode === 'create' ? 'Tạo dự án' : 'Lưu thay đổi'}
      </button>
    </form>
  )
}
