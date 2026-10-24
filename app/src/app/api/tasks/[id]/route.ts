import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

interface RouteContext {
  params: { id: string }
}

// ─── GET /api/tasks/[id] ──────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { id: true, name: true, departmentId: true } },
        owner: { select: { id: true, fullName: true } },
        taskLinks: { select: { id: true, linkedTaskId: true } },
      },
    })

    if (!task || task.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // RBAC: MEMBER see own tasks, MANAGER see dept tasks, ADMIN see all
    if (session.user.role === 'MEMBER' && task.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (session.user.role === 'MANAGER' && task.project.departmentId !== session.user.departmentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH /api/tasks/[id] ────────────────────────────────────────────────────

const UpdateTaskSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  ownerId: z.string().uuid().optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true, ownerId: true, status: true, priority: true, deletedAt: true },
    })

    if (!task || task.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Get project dept
    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      select: { departmentId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // RBAC: owner, MANAGER of dept, or ADMIN
    const isOwner = task.ownerId === session.user.id
    const isManager = session.user.role === 'MANAGER' && project.departmentId === session.user.departmentId
    const isAdmin = session.user.role === 'ADMIN'

    if (!isOwner && !isManager && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = UpdateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { status, priority, ownerId } = parsed.data

    // If changing ownerId, verify user exists in same dept
    if (ownerId) {
      const newOwner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { departmentId: true, active: true },
      })

      if (!newOwner || !newOwner.active || newOwner.departmentId !== project.departmentId) {
        return NextResponse.json({ error: 'Invalid ownerId' }, { status: 400 })
      }
    }

    const before = await prisma.task.findUnique({ where: { id: params.id } })

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(ownerId && { ownerId }),
      },
      include: {
        project: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
      },
    })

    // Ghi ActivityLog (best-effort, don't block on failure)
    try {
      await prisma.activityLog.create({
        data: {
          actorId: session.user.id,
          entity: 'task',
          entityId: params.id,
          action: 'update',
          before: {
            status: before?.status,
            priority: before?.priority,
            ownerId: before?.ownerId,
          },
          after: {
            status: updated.status,
            priority: updated.priority,
            ownerId: updated.ownerId,
          },
        },
      })
    } catch (logErr) {
      console.warn('ActivityLog create failed:', logErr)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE /api/tasks/[id] (soft delete) ──────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true, ownerId: true, deletedAt: true },
    })

    if (!task || task.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Get project dept
    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      select: { departmentId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // RBAC: owner, MANAGER of dept, or ADMIN
    const isOwner = task.ownerId === session.user.id
    const isManager = session.user.role === 'MANAGER' && project.departmentId === session.user.departmentId
    const isAdmin = session.user.role === 'ADMIN'

    if (!isOwner && !isManager && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Soft delete
    const deleted = await prisma.task.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    // Ghi ActivityLog (best-effort, don't block on failure)
    try {
      await prisma.activityLog.create({
        data: {
          actorId: session.user.id,
          entity: 'task',
          entityId: params.id,
          action: 'delete',
        },
      })
    } catch (logErr) {
      console.warn('ActivityLog create failed:', logErr)
    }

    return NextResponse.json({ message: 'Task deleted', data: deleted })
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
