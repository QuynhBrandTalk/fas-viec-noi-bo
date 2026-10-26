'use server'

import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { signIn, signOut } from '@/lib/auth'

const GENERIC_ERROR = 'Liên kết không hợp lệ, đã hết hạn hoặc đã được dùng. Vui lòng yêu cầu liên kết mới.'

/** Bấm nút "Đăng nhập" trên trang /auth/verify → đổi token lấy phiên. */
export async function loginWithToken(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  try {
    await signIn('magic-link', { token, redirectTo: '/hom-nay' })
  } catch (e) {
    // signIn thành công sẽ ném NEXT_REDIRECT — không bắt lỗi đó
    if (e instanceof AuthError) {
      redirect('/dang-nhap?error=' + encodeURIComponent(GENERIC_ERROR))
    }
    throw e
  }
}

export async function logout() {
  await signOut({ redirectTo: '/dang-nhap' })
}
