import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { badRequest, forbidden, guardMutation, json, logActivity, readJson, serverError, unauthorized } from '@/lib/api'

// GET /api/users — ADMIN và MANAGER
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (!can(user, 'user:read')) return forbidden()

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        active: true,
        lastLoginAt: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    })
    return json({ users })
  } catch (err) {
    return serverError('GET /api/users', err)
  }
}

const Invite = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  fullName: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(120),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
  departmentId: z.string().optional(),
})

// POST /api/users — mời người dùng (chỉ ADMIN)
export async function POST(req: NextRequest) {
  const blocked = guardMutation(req)
  if (blocked) return blocked
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (!can(user, 'user:manage')) return forbidden()

    const parsed = Invite.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ')
    const { email, fullName, role, departmentId } = parsed.data
    const normalizedEmail = email.toLowerCase()

    if (role === 'MANAGER' && !departmentId) return badRequest('Quản lý phải thuộc một bộ phận')

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
    if (existing) return json({ error: 'Email này đã có trong hệ thống' }, 409)

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.user.create({
        data: { email: normalizedEmail, fullName, role, departmentId: departmentId || null },
        select: { id: true, email: true, fullName: true, role: true, departmentId: true },
      })
      await logActivity(tx, {
        actorId: user.id,
        entity: 'user',
        entityId: row.id,
        action: 'invite',
        after: { role, departmentId: row.departmentId },
      })
      return row
    })
    return json({ user: created }, 201)
  } catch (err) {
    return serverError('POST /api/users', err)
  }
}
