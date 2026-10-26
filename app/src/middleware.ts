import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

// Middleware chạy ở Edge: chỉ dùng cấu hình không có Prisma.
// API route tự kiểm tra phiên, nên không đi qua middleware.
export default NextAuth(authConfig).auth

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
