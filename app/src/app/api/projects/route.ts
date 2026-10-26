import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { badRequest, dateString, forbidden, json, logActivity, readJson, serverError, unauthorized } from '@/lib/api'

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  departmentId: z.string().min(1).optional(),
})
const PAGE_SIZE = 50

// GET /api/projects — mọi người dùng xem được tất cả dự án (theo kiến trúc)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()

    const parsed = ListQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) return badRequest('Tham số không hợp lệ', parsed.error.flatten())
    const { page, departmentId } = parsed.data

    const where = { deletedAt: null, ...(departmentId ? { departmentId: departmentId } : {}) }
    const [data, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: { department: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.project.count({ where }),
    ])
    return json({ data, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } })
  } catch (err) {
    return serverError('GET /api/projects', err)
  }
}

const CreateProject = z.object({
  name: z.string().trim().min(1, 'Tên dự án không được trống').max(200),
  departmentId: z.string().min(1, 'Chọn bộ phận'),
  startDate: dateString,
  endDate: dateString,
})

// POST /api/projects — ADMIN, hoặc MANAGER trong bộ phận mình
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()

    const parsed = CreateProject.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ', parsed.error.flatten())
    const { name, departmentId, startDate, endDate } = parsed.data

    if (!can(user, 'project:create', { departmentId })) return forbidden()
    if (endDate < startDate) return badRequest('Ngày kết thúc không được trước ngày bắt đầu')

    const dept = await prisma.department.findFirst({ where: { id: departmentId, active: true }, select: { id: true } })
    if (!dept) return badRequest('Bộ phận không tồn tại')

    const project = await prisma.project.create({
      data: { name, departmentId, startDate, endDate, ownerId: user.id },
      include: { department: { select: { id: true, name: true } } },
    })
    await logActivity({
      actorId: user.id,
      entity: 'project',
      entityId: project.id,
      action: 'create',
      after: { name, departmentId, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    })
    return json(project, 201)
  } catch (err) {
    return serverError('POST /api/projects', err)
  }
}
