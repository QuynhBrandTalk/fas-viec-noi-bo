import LoginForm from './LoginForm'

export default function DangNhapPage({ searchParams }: { searchParams: { error?: string } }) {
  const brandName = process.env.BRAND_NAME ?? 'Việc nội bộ'
  // Auth.js có thể gắn mã lỗi kỹ thuật (vd. CredentialsSignin) — đổi thành câu chung
  const raw = searchParams.error ?? ''
  const error = raw && /^[A-Za-z]+$/.test(raw) ? 'Đăng nhập không thành công. Vui lòng thử lại.' : raw

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">{brandName}</h1>
          <p className="text-sm text-gray-500 mb-6">Đăng nhập để tiếp tục</p>
          <LoginForm initialError={error} />
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          Chỉ dành cho nhân viên được mời. Liên hệ admin nếu cần hỗ trợ.
        </p>
      </div>
    </div>
  )
}
