import { NextRequest, NextResponse } from 'next/server'
import { verifyMagicToken, signIn } from '@/lib/auth'

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

  // Tạo JWT session thông qua NextAuth CredentialsProvider nội bộ
  try {
    await signIn('magic-link', {
      userId: result.userId,
      redirectTo: '/hom-nay',
    })
  } catch (error: unknown) {
    // NextAuth ném NEXT_REDIRECT exception — đây là cơ chế bình thường
    // Phải re-throw để Next.js xử lý redirect
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    // Lỗi thật
    return NextResponse.redirect(new URL('/dang-nhap?error=server-error', req.url))
  }

  return NextResponse.redirect(new URL('/hom-nay', req.url))
}
