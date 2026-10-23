import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { z } from 'zod'
import type { Role } from '@prisma/client'

// GET /api/users — danh sách người dùng (chỉ ADMIN và MANAGER)
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const userRole = session.user.role as Role
  if (!can({ role: userRole }, 'user:manage') && !can({ role: userRole }, 'report:read')) {
    return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })
  }

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

  return NextResponse.json({ users })
}

// POST /api/users — mời người dùng mới (chỉ ADMIN)
const inviteSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
  departmentId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  if (!can({ role: session.user.role as Role }, 'user:invite')) {
    return NextResponse.json({ error: 'Không có quyền mời người dùng' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { email, fullName, role, departmentId } = parsed.data
  const normalizedEmail = email.toLowerCase().trim()

  // Kiểm tra email đã tồn tại chưa
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: 'Email này đã được dùng trong hệ thống' }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      fullName,
      role: role as Role,
      departmentId: departmentId || null,
    },
  })

  return NextResponse.json({ user }, { status: 201 })
}
