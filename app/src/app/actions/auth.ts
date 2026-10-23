'use server'

import { signIn } from '@/lib/auth'
import { isRedirectError } from 'next/dist/client/components/redirect'

/**
 * Server Action: tạo session NextAuth sau khi magic link đã được verify.
 * signIn() chỉ hoạt động trong Server Action, không phải Route Handler.
 */
export async function loginWithUserId(userId: string) {
  try {
    await signIn('magic-link', {
      userId,
      redirectTo: '/hom-nay',
    })
  } catch (e) {
    // NextAuth v5 ném NEXT_REDIRECT exception để trigger redirect —
    // đây là cơ chế bình thường, phải re-throw để Next.js xử lý
    if (isRedirectError(e)) throw e
    // Lỗi thật (DB lỗi, config sai...)
    throw new Error('Đăng nhập thất bại. Vui lòng thử lại.')
  }
}
