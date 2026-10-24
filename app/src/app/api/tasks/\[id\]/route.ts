import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: { id: string }
}

// ─── GET /api/tasks/[id] ────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
        department: { select: { name: true } },
        links: { select: { id: true, title: true, url: true, createdAt: true } },
      },
    })

    if (!task || task.deletedAt) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // RBAC: MEMBER xem task của mình, MANAGER xem phòng ban, ADMIN tất cả
    if (session.user.role === 'MEMBER' && task.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (session.user.role === 'MANAGER' && task.departmentId !== session.user.departmentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE /api/tasks/[id] (soft delete) ───────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { createdBy: true, departmentId: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // RBAC: creator hoặc ADMIN
    if (session.user.role !== 'ADMIN' && task.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deleted = await prisma.task.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    // Ghi ActivityLog
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        entity: 'task',
        entityId: params.id,
        action: 'delete',
      },
    })

    return NextResponse.json({ message: 'Task deleted', data: deleted })
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
