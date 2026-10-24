import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { z } from 'zod'

interface RouteContext {
  params: { id: string }
}

// ─── GET /api/projects/[id] ──────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { department: { select: { id: true, name: true } } },
    })

    if (!project || project.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // RBAC: MANAGER xem phòng ban mình, ADMIN xem tất cả, MEMBER không xem
    if (session.user.role === 'MEMBER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (session.user.role === 'MANAGER' && project.departmentId !== session.user.departmentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH /api/projects/[id] ───────────────────────────────────────────────

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  endDate: z.string().datetime().optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { departmentId: true, ownerId: true, startDate: true, deletedAt: true },
    })

    if (!project || project.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // RBAC: MANAGER của phòng ban hoặc ADMIN
    if (session.user.role === 'MANAGER' && project.departmentId !== session.user.departmentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (session.user.role === 'MEMBER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = UpdateProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, endDate } = parsed.data

    // Validate ngày nếu update
    if (endDate) {
      const end = new Date(endDate)
      if (project.startDate >= end) {
        return NextResponse.json({ error: 'endDate phải sau startDate' }, { status: 400 })
      }
    }

    const before = await prisma.project.findUnique({ where: { id: params.id } })

    const updated = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: { department: { select: { name: true } } },
    })

    // Ghi ActivityLog
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        entity: 'project',
        entityId: params.id,
        action: 'update',
        before: {
          name: before?.name,
          endDate: before?.endDate,
        },
        after: {
          name: updated.name,
          endDate: updated.endDate,
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE /api/projects/[id] (soft delete) ────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { ownerId: true, departmentId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // RBAC: chỉ creator hoặc ADMIN
    if (session.user.role !== 'ADMIN' && project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Soft delete: set deletedAt (như tasks, cho consistency)
    // Không xóa thật — các query sẽ filter deletedAt: null
    const deleted = await prisma.project.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    // Ghi ActivityLog
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        entity: 'project',
        entityId: params.id,
        action: 'delete',
      },
    })

    return NextResponse.json({ message: 'Project deleted', data: deleted })
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
