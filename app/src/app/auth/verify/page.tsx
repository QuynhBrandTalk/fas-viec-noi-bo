import { loginWithToken } from '@/app/actions/auth'

/**
 * Trang đích của magic link.
 * Không tự đăng nhập khi mở trang: một số hệ thống quét email tự mở link,
 * nếu tự đăng nhập thì token sẽ bị "đốt" trước khi người dùng bấm.
 * Người dùng bấm nút → server action đổi token lấy phiên.
 */
export default function VerifyPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? ''
  const brandName = process.env.BRAND_NAME ?? 'Việc nội bộ'

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-semibold mb-1">{brandName}</h1>
        {token ? (
          <form action={loginWithToken} className="mt-6 space-y-4">
            <input type="hidden" name="token" value={token} />
            <p className="text-sm text-gray-600">Bấm nút bên dưới để hoàn tất đăng nhập.</p>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
            >
              Đăng nhập
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-red-600">Thiếu mã đăng nhập. Vui lòng mở lại liên kết trong email.</p>
        )}
      </div>
    </div>
  )
}
