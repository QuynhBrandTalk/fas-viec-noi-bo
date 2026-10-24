import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// ─── GET /api/tasks?projectId=...&ownerId=...&status=...&page=1 ──────────────

const GetTasksSchema = z.object({
  projectId: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.enum(['TODO', 'DOING', 'DONE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = GetTasksSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query params', details: parsed.error.flatten() }, { status: 400 })
    }

    const { projectId, ownerId, status, page, limit } = parsed.data

    let filter: any = { deletedAt: null }
    if (projectId) filter.projectId = projectId
    if (status) filter.status = status

    // RBAC: MEMBER xem task của mình, MANAGER xem phòng ban, ADMIN xem tất cả
    if (session.user.role === 'MEMBER') {
      filter.ownerId = session.user.id
    } else if (session.user.role === 'MANAGER') {
      filter.departmentId = session.user.departmentId
    }

    const skip = (page - 1) * limit

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: filter,
        include: {
          owner: { select: { id: true, fullName: true } },
          project: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      prisma.task.count({ where: filter }),
    ])

    return NextResponse.json({
      data: tasks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('GET /api/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/tasks ────────────────────────────────────────────────────────

const CreateTaskSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  startDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RBAC: chỉ ADMIN/MANAGER tạo task
    if (session.user.role === 'MEMBER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = CreateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { projectId, title, description, ownerId, startDate, dueDate, priority } = parsed.data

    // Verify project tồn tại và MANAGER có quyền
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { departmentId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (session.user.role === 'MANAGER' && project.departmentId !== session.user.departmentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate ngày
    const start = new Date(startDate)
    const due = new Date(dueDate)
    if (start >= due) {
      return NextResponse.json({ error: 'startDate phải trước dueDate' }, { status: 400 })
    }

    // Tạo task
    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        ownerId: ownerId || undefined,
        departmentId: project.departmentId,
        startDate: start,
        dueDate: due,
        priority,
        createdBy: session.user.id,
      },
      include: {
        owner: { select: { fullName: true } },
        project: { select: { name: true } },
      },
    })

    // Ghi ActivityLog
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        entity: 'task',
        entityId: task.id,
        action: 'create',
        after: { title, projectId, priority },
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('POST /api/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
