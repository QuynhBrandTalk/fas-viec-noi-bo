import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Các path không cần xác thực
const PUBLIC_PATHS = [
  '/dang-nhap',
  '/api/auth',       // NextAuth handlers
  '/api/healthz',    // Docker healthcheck
  '/auth/callback',  // Intermediate page sau magic link verify
]

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl

  // Cho qua các path công khai
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Chưa đăng nhập → redirect về trang đăng nhập
  if (!req.auth) {
    const loginUrl = new URL('/dang-nhap', req.url)
    loginUrl.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // Đã đăng nhập mà vào /dang-nhap → redirect về /hom-nay
  if (pathname === '/dang-nhap') {
    return NextResponse.redirect(new URL('/hom-nay', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match tất cả path trừ:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
