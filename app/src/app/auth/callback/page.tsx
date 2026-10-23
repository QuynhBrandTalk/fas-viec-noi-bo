import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { loginWithUserId } from '@/app/actions/auth'
import { verifyNonce, NONCE_COOKIE_NAME } from '@/lib/auth-nonce'

/**
 * /auth/callback
 *
 * Đọc signed nonce cookie do /api/auth/verify set, verify chữ ký + expiry,
 * rồi gọi Server Action để tạo NextAuth session.
 *
 * Không nhận uid từ URL (tránh forge). Cookie là bằng chứng rằng
 * magic link đã được verify thành công trong 60 giây vừa rồi.
 */
export default async function AuthCallbackPage() {
  const cookieStore = cookies()
  const nonceCookie = cookieStore.get(NONCE_COOKIE_NAME)

  if (!nonceCookie?.value) {
    redirect('/dang-nhap?error=' + encodeURIComponent('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'))
  }

  const userId = verifyNonce(nonceCookie.value)

  if (!userId) {
    redirect('/dang-nhap?error=' + encodeURIComponent('Liên kết đã hết hạn. Vui lòng yêu cầu liên kết mới.'))
  }

  // Gọi Server Action — signIn() chỉ hoạt động trong Server Action context
  // Cookie sẽ tự expire sau 60s (không cần xóa thủ công)
  try {
    await loginWithUserId(userId)
  } catch {
    redirect('/dang-nhap?error=' + encodeURIComponent('Đăng nhập thất bại. Vui lòng thử lại.'))
  }

  // loginWithUserId luôn redirect hoặc throw — không bao giờ đến đây
  redirect('/hom-nay')
}
