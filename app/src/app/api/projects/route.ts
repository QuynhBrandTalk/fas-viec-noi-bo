import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { z } from 'zod'

// ─── GET /api/projects?page=1&limit=50&departmentId=...&status=... ──────────────

const GetProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  departmentId: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate query params
    const parsed = GetProjectsSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query params', details: parsed.error.flatten() }, { status: 400 })
    }

    const { page, limit, departmentId, status } = parsed.data

    // RBAC: MANAGER xem phòng ban mình, ADMIN xem tất cả
    let filter: any = { deletedAt: null }
    if (status) filter.status = status

    if (session.user.role === 'MANAGER') {
      filter.departmentId = session.user.departmentId
    } else if (session.user.role === 'MEMBER') {
      // MEMBER không xem được project list (chỉ xem task của mình)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (departmentId && session.user.role === 'MANAGER') {
      // MANAGER chỉ xem được phòng ban của mình
      if (departmentId !== session.user.departmentId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    if (departmentId && session.user.role === 'ADMIN') {
      filter.departmentId = departmentId
    }

    const skip = (page - 1) * limit

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: filter,
        include: {
          department: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.project.count({ where: filter }),
    ])

    return NextResponse.json({
      data: projects,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/projects ──────────────────────────────────────────────────────

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  departmentId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RBAC: chỉ ADMIN/MANAGER tạo project
    if (session.user.role === 'MEMBER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = CreateProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, startDate, endDate, departmentId } = parsed.data

    // RBAC: MANAGER chỉ tạo trong phòng ban của mình
    if (session.user.role === 'MANAGER' && departmentId !== session.user.departmentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate ngày
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start >= end) {
      return NextResponse.json({ error: 'startDate phải trước endDate' }, { status: 400 })
    }

    // Tạo project
    const project = await prisma.project.create({
      data: {
        name,
        ownerId: session.user.id,
        departmentId,
        startDate: start,
        endDate: end,
      },
      include: { department: { select: { name: true } } },
    })

    // Ghi ActivityLog
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        entity: 'project',
        entityId: project.id,
        action: 'create',
        after: { name, startDate, endDate, departmentId },
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
