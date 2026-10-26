import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@prisma/client'

/**
 * Cấu hình dùng chung, AN TOÀN cho Edge runtime (middleware).
 * Không import Prisma, nodemailer hay 'crypto' ở file này.
 * Phần cần database nằm ở src/lib/auth.ts (chỉ chạy trên Node).
 */

const PUBLIC_PATHS = ['/dang-nhap', '/auth/verify']

// Kiến trúc: phiên hết hạn sau 30 phút không hoạt động
export const SESSION_IDLE_SECONDS = 30 * 60

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/dang-nhap',
    error: '/dang-nhap',
  },
  session: { strategy: 'jwt', maxAge: SESSION_IDLE_SECONDS },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const loggedIn = !!auth?.user

      // Trang đăng nhập luôn mở. Việc chuyển người đã đăng nhập về /hom-nay
      // do trang /dang-nhap tự làm sau khi kiểm tra database (người bị khoá
      // vẫn có JWT hợp lệ, nếu chuyển ở đây sẽ tạo vòng lặp chuyển hướng).
      if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true
      // false → Auth.js chuyển về trang signIn (/dang-nhap)
      return loggedIn
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.role = user.role
        token.departmentId = user.departmentId ?? undefined
      }
      return token
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub
        if (token.role) session.user.role = token.role as Role
        session.user.departmentId = typeof token.departmentId === 'string' ? token.departmentId : undefined
      }
      return session
    },
  },
} satisfies NextAuthConfig
