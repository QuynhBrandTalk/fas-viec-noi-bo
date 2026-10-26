import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { Role } from '@prisma/client'
import crypto from 'crypto'
import { authConfig } from '@/auth.config'
import { prisma } from '@/lib/prisma'
import { sendMagicLink } from '@/lib/mailer'

// Giới hạn gửi magic link: 5/email/giờ, 20/IP/giờ (theo đặc tả M2)
const RATE_LIMIT_EMAIL = 5
const RATE_LIMIT_IP = 20
const TOKEN_EXPIRY_MINUTES = 15

// Rate limit trong bộ nhớ: đủ cho 1 tiến trình trên VPS (~40 người dùng)
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

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

class InvalidMagicLink extends CredentialsSignin {
  code = 'invalid_link'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Credential là token một lần trong email, KHÔNG phải userId.
    // Không ai đăng nhập được nếu không có token hợp lệ, chưa dùng, chưa hết hạn.
    Credentials({
      id: 'magic-link',
      credentials: { token: { type: 'text' } },
      async authorize(credentials) {
        const token = typeof credentials?.token === 'string' ? credentials.token : ''
        if (!/^[a-f0-9]{64}$/.test(token)) throw new InvalidMagicLink()

        const userId = await consumeMagicToken(token)
        if (!userId) throw new InvalidMagicLink()

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, fullName: true, role: true, departmentId: true, active: true },
        })
        if (!user || !user.active) throw new InvalidMagicLink()

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          departmentId: user.departmentId,
        }
      },
    }),
  ],
})

// ─── Người dùng hiện tại ─────────────────────────────────────────────────────

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: Role
  departmentId: string | null
}

/**
 * Đọc phiên rồi đối chiếu lại database trên MỖI yêu cầu:
 * người bị vô hiệu hoá mất quyền ngay, đổi vai trò có hiệu lực ngay.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, fullName: true, role: true, departmentId: true, active: true },
  })
  if (!user || !user.active) return null

  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
    departmentId: user.departmentId,
  }
}

// ─── Magic link ──────────────────────────────────────────────────────────────

export async function requestMagicLink(
  email: string,
  ip: string,
): Promise<{ ok: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim()

  if (!checkRateLimit(`email:${normalizedEmail}`, RATE_LIMIT_EMAIL)) {
    return { ok: false, error: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau 1 giờ.' }
  }
  if (!checkRateLimit(`ip:${ip}`, RATE_LIMIT_IP)) {
    return { ok: false, error: 'Quá nhiều yêu cầu từ địa chỉ này. Vui lòng thử lại sau.' }
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, active: true, fullName: true },
  })

  // Trả về ok dù email không tồn tại — không tiết lộ email nào có trong hệ thống
  if (!user || !user.active) return { ok: true }

  const token = crypto.randomBytes(32).toString('hex')
  await prisma.loginToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000),
    },
  })

  const baseUrl = (process.env.NEXTAUTH_URL ?? process.env.APP_DOMAIN ?? '').replace(/\/$/, '')
  const magicUrl = `${baseUrl}/auth/verify?token=${token}`

  await sendMagicLink({ to: normalizedEmail, name: user.fullName, magicUrl })
  return { ok: true }
}

/**
 * Đánh dấu token đã dùng (nguyên tử) và trả về userId.
 * Token sai, hết hạn hoặc đã dùng đều trả null — cùng một thông báo chung.
 */
async function consumeMagicToken(token: string): Promise<string | null> {
  const now = new Date()
  const record = await prisma.loginToken.findFirst({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  })
  if (!record || record.usedAt || record.expiresAt < now) return null

  const updated = await prisma.loginToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: now },
  })
  if (updated.count === 0) return null

  await prisma.user.update({ where: { id: record.userId }, data: { lastLoginAt: now } })
  return record.userId
}
