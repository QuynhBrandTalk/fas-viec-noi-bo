import { NextRequest, NextResponse } from 'next/server'
import { verifyMagicToken } from '@/lib/auth'

/**
 * GET /api/auth/verify?token=...
 *
 * Xác minh magic link token, sau đó redirect sang /auth/callback để
 * tạo session qua Server Action (signIn() chỉ hoạt động trong Server Action,
 * không hoạt động trong Route Handler — NextAuth v5 limitation).
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

  // Redirect sang callback page để tạo session qua Server Action
  // userId được encode vào URL tạm (ngắn hạn, không nhạy cảm — không phải token thật)
  const callbackUrl = new URL('/auth/callback', req.url)
  callbackUrl.searchParams.set('uid', result.userId)
  return NextResponse.redirect(callbackUrl)
}
