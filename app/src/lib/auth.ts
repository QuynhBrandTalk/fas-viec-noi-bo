import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { NextAuthConfig } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { sendMagicLink } from '@/lib/mailer'
import crypto from 'crypto'

// Số lần gửi magic link tối đa: 5/email/giờ, 20/IP/giờ
const RATE_LIMIT_EMAIL = 5
const RATE_LIMIT_IP = 20
const TOKEN_EXPIRY_MINUTES = 15

// In-memory rate limit đơn giản (đủ dùng cho ~40 người)
// Nếu scale cần chuyển sang Redis
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, max: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 3600 * 1000 })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/dang-nhap',
    error: '/dang-nhap',
  },
  providers: [
    // CredentialsProvider chỉ dùng nội bộ sau khi verify magic link
    Credentials({
      id: 'magic-link',
      credentials: {
        userId: { type: 'text' },
      },
      async authorize(credentials) {
        const userId = credentials?.userId as string | undefined
        if (!userId) return null

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, fullName: true, role: true, departmentId: true, active: true },
        })

        if (!user || !user.active) return null

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            departmentId: true,
            active: true,
          },
        })
        if (user && user.active) {
          session.user = {
            ...session.user,
            id: user.id,
            name: user.fullName,
            role: user.role,
            departmentId: user.departmentId ?? undefined,
          }
        }
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id
      return token
    },
  },
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 }, // 12 giờ tối đa
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

// ─── Magic Link logic ─────────────────────────────────────────────────────────

export async function requestMagicLink(email: string, ip: string): Promise<{
  ok: boolean
  error?: string
}> {
  const normalizedEmail = email.toLowerCase().trim()

  // Kiểm tra rate limit
  if (!checkRateLimit(`email:${normalizedEmail}`, RATE_LIMIT_EMAIL)) {
    return { ok: false, error: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau 1 giờ.' }
  }
  if (!checkRateLimit(`ip:${ip}`, RATE_LIMIT_IP)) {
    return { ok: false, error: 'Quá nhiều yêu cầu từ địa chỉ này.' }
  }

  // Kiểm tra email tồn tại và đang active (không tiết lộ nếu không tồn tại)
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, active: true, fullName: true },
  })

  if (!user || !user.active) {
    // Trả về ok để không tiết lộ email có tồn tại hay không
    return { ok: true }
  }

  // Tạo token
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000)

  await prisma.loginToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  })

  const magicUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify?token=${token}`

  await sendMagicLink({
    to: normalizedEmail,
    name: user.fullName,
    magicUrl,
  })

  return { ok: true }
}

export async function verifyMagicToken(token: string): Promise<{
  userId?: string
  error?: string
}> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const record = await prisma.loginToken.findFirst({
    where: { tokenHash },
    include: { user: { select: { id: true, active: true } } },
  })

  if (!record) return { error: 'Liên kết không hợp lệ hoặc đã hết hạn.' }
  if (record.usedAt) return { error: 'Liên kết này đã được sử dụng.' }
  if (record.expiresAt < new Date()) return { error: 'Liên kết đã hết hạn (15 phút). Vui lòng yêu cầu liên kết mới.' }
  if (!record.user.active) return { error: 'Tài khoản đã bị vô hiệu hoá.' }

  // Đánh dấu token đã dùng
  await prisma.loginToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  })

  // Cập nhật last login
  await prisma.user.update({
    where: { id: record.userId },
    data: { lastLoginAt: new Date() },
  })

  return { userId: record.userId }
}
