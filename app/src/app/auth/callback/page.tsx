import { redirect } from 'next/navigation'
import { loginWithUserId } from '@/app/actions/auth'

interface Props {
  searchParams: { uid?: string }
}

/**
 * /auth/callback?uid=...
 *
 * Intermediate page: nhận userId từ query param (đã được verify bởi
 * /api/auth/verify), gọi Server Action để tạo NextAuth session.
 *
 * Không render UI — chỉ là điểm chuyển tiếp để signIn() chạy
 * trong Server Action context (NextAuth v5 requirement).
 */
export default async function AuthCallbackPage({ searchParams }: Props) {
  const uid = searchParams.uid

  if (!uid) {
    redirect('/dang-nhap?error=' + encodeURIComponent('Phiên đăng nhập không hợp lệ.'))
  }

  try {
    // Server Action tạo session và redirect về /hom-nay
    await loginWithUserId(uid)
  } catch {
    redirect('/dang-nhap?error=' + encodeURIComponent('Đăng nhập thất bại. Vui lòng thử lại.'))
  }

  // Không bao giờ đến đây (loginWithUserId luôn redirect hoặc throw)
  redirect('/hom-nay')
}
