'use client'

import { useState } from 'react'

export default function DangNhapPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Việc nội bộ'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Có lỗi xảy ra. Vui lòng thử lại.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Không thể kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">{brandName}</h1>
          <p className="text-sm text-gray-500 mb-6">Đăng nhập để tiếp tục</p>

          {sent ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">📧</div>
              <p className="text-sm font-medium text-gray-800 mb-1">Kiểm tra hộp thư của bạn</p>
              <p className="text-sm text-gray-500">
                Chúng tôi đã gửi liên kết đăng nhập tới{' '}
                <span className="font-medium text-gray-700">{email}</span>.
              </p>
              <p className="text-xs text-gray-400 mt-3">Liên kết hết hạn sau 15 phút.</p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-4 text-xs text-blue-600 hover:underline"
              >
                Dùng email khác
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@congty.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? 'Đang gửi…' : 'Gửi liên kết đăng nhập'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Chỉ dành cho nhân viên được mời. Liên hệ admin nếu cần hỗ trợ.
        </p>
      </div>
    </div>
  )
}
