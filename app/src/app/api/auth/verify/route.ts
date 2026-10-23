import { NextRequest, NextResponse } from 'next/server'
import { verifyMagicToken } from '@/lib/auth'
import { createNonce, NONCE_COOKIE_NAME, NONCE_TTL_SECONDS_EXPORT } from '@/lib/auth-nonce'

/**
 * GET /api/auth/verify?token=...
 *
 * 1. Verify magic link token (atomic — mark used, check expiry)
 * 2. Set HttpOnly signed nonce cookie (60s TTL)
 * 3. Redirect → /auth/callback (không expose userId trong URL)
 *
 * /auth/callback đọc cookie để xác minh rằng verify đã thực sự xảy ra
 * trước khi gọi signIn(). Ngăn session hijack qua /auth/callback?uid=forge.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/dang-nhap?error=missing-token', req.url))
  }

  const result = await verifyMagicToken(token)

  if (result.error || !result.userId) {
    const encoded = encodeURIComponent(result.error ?? 'Liên kết không hợp lệ.')
    return NextResponse.redirect(new URL(`/dang-nhap?error=${encoded}`, req.url))
  }

  // Tạo signed nonce — ràng buộc verify này với /auth/callback cụ thể
  const nonce = createNonce(result.userId)

  const response = NextResponse.redirect(new URL('/auth/callback', req.url))

  // HttpOnly + SameSite=Lax: không đọc được từ JS, chỉ gửi same-origin
  response.cookies.set(NONCE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: NONCE_TTL_SECONDS_EXPORT,
    path: '/auth/callback', // chỉ gửi đến đúng path
  })

  return response
}
