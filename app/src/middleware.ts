import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Routes không cần đăng nhập
const PUBLIC_PATHS = ['/dang-nhap', '/api/auth', '/healthz']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!isPublic && !req.auth) {
    const loginUrl = new URL('/dang-nhap', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Đã đăng nhập mà vào trang đăng nhập → redirect về hôm nay
  if (pathname === '/dang-nhap' && req.auth) {
    return NextResponse.redirect(new URL('/hom-nay', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
