import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import {
  badRequest,
  dateString,
  durationDays,
  forbidden,
  json,
  logActivity,
  readJson,
  serverError,
  unauthorized,
} from '@/lib/api'

const ListQuery = z.object({
  projectId: z.string().min(1).optional(),
  ownerId: z.string().min(1).optional(),
  status: z.enum(['TODO', 'DOING', 'DONE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
})
const PAGE_SIZE = 50

// GET /api/tasks — mọi người dùng xem được tất cả việc (theo kiến trúc)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()

    const parsed = ListQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) return badRequest('Tham số không hợp lệ', parsed.error.flatten())
    const { projectId, ownerId, status, page } = parsed.data

    const where = {
      deletedAt: null,
      project: { deletedAt: null },
      ...(projectId && { projectId }),
      ...(ownerId && { ownerId }),
      ...(status && { status }),
    }
    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          owner: { select: { id: true, fullName: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.task.count({ where }),
    ])
    return json({ data, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } })
  } catch (err) {
    return serverError('GET /api/tasks', err)
  }
}

const CreateTask = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1, 'Tiêu đề không được trống').max(200),
  description: z.string().max(5000).optional(),
  ownerId: z.string().min(1).nullable().optional(),
  startDate: dateString,
  dueDate: dateString,
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
})

// POST /api/tasks — ADMIN, hoặc MANAGER của bộ phận sở hữu dự án
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()

    const parsed = CreateTask.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ', parsed.error.flatten())
    const { projectId, title, description, ownerId, startDate, dueDate, priority } = parsed.data

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, departmentId: true },
    })
    if (!project) return badRequest('Dự án không tồn tại')
    if (!can(user, 'task:create', { departmentId: project.departmentId })) return forbidden()

    // Đặc tả M3: due_date < start_date bị từ chối (cùng ngày thì hợp lệ)
    if (dueDate < startDate) return badRequest('Hạn hoàn thành không được trước ngày bắt đầu')

    if (ownerId) {
      const owner = await prisma.user.findFirst({ where: { id: ownerId, active: true }, select: { id: true } })
      if (!owner) return badRequest('Người phụ trách không hợp lệ')
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description: description || null,
        ownerId: ownerId || null,
        departmentId: project.departmentId,
        startDate,
        dueDate,
        durationDays: durationDays(startDate, dueDate),
        priority,
        createdBy: user.id,
      },
      include: {
        owner: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
      },
    })
    await logActivity({
      actorId: user.id,
      entity: 'task',
      entityId: task.id,
      action: 'create',
      after: { title, projectId, ownerId: ownerId ?? null, priority },
    })
    return json(task, 201)
  } catch (err) {
    return serverError('POST /api/tasks', err)
  }
}
