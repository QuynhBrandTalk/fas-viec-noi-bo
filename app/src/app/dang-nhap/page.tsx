import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

// Chỉ hiển thị thông báo cố định theo mã — không in nội dung tuỳ ý từ URL
const ERRORS: Record<string, string> = {
  link: 'Liên kết không hợp lệ, đã hết hạn hoặc đã được dùng. Vui lòng yêu cầu liên kết mới.',
  session: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
}
const DEFAULT_ERROR = 'Đăng nhập không thành công. Vui lòng thử lại.'

export default async function DangNhapPage({ searchParams }: { searchParams: { error?: string } }) {
  // Đã đăng nhập (và tài khoản còn hoạt động) thì vào thẳng app
  if (await getCurrentUser()) redirect('/hom-nay')

  const brandName = process.env.BRAND_NAME ?? 'Việc nội bộ'
  const code = searchParams.error
  const error = code ? (ERRORS[code] ?? DEFAULT_ERROR) : ''

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
