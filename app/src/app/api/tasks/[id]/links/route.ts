import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

interface RouteContext {
  params: { id: string }
}

// ─── POST /api/tasks/[id]/links ────────────────────────────────────────────────

const CreateTaskLinkSchema = z.object({
  linkedTaskId: z.string().uuid('linkedTaskId phải là UUID'),
})

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sourceTask = await prisma.task.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true, ownerId: true, deletedAt: true },
    })

    if (!sourceTask || sourceTask.deletedAt) {
      return NextResponse.json({ error: 'Source task not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = CreateTaskLinkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { linkedTaskId } = parsed.data

    // Prevent self-link
    if (linkedTaskId === params.id) {
      return NextResponse.json({ error: 'Cannot link task to itself' }, { status: 400 })
    }

    // Verify linked task exists
    const linkedTask = await prisma.task.findUnique({
      where: { id: linkedTaskId },
      select: { id: true, projectId: true, deletedAt: true },
    })

    if (!linkedTask || linkedTask.deletedAt) {
      return NextResponse.json({ error: 'Linked task not found' }, { status: 404 })
    }

    // Get source project for RBAC
    const sourceProject = await prisma.project.findUnique({
      where: { id: sourceTask.projectId },
      select: { departmentId: true },
    })

    if (!sourceProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // RBAC: owner, MANAGER of dept, or ADMIN
    const isOwner = sourceTask.ownerId === session.user.id
    const isManager = session.user.role === 'MANAGER' && sourceProject.departmentId === session.user.departmentId
    const isAdmin = session.user.role === 'ADMIN'

    if (!isOwner && !isManager && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check circular dependency (simple: linkedTask should not link back to sourceTask)
    const reverseLink = await prisma.taskLink.findFirst({
      where: {
        taskId: linkedTaskId,
        linkedTaskId: params.id,
      },
    })

    if (reverseLink) {
      return NextResponse.json({ error: 'Circular dependency detected' }, { status: 400 })
    }

    // Check duplicate
    const existing = await prisma.taskLink.findFirst({
      where: {
        taskId: params.id,
        linkedTaskId,
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Link already exists' }, { status: 400 })
    }

    // Create link
    const link = await prisma.taskLink.create({
      data: {
        taskId: params.id,
        linkedTaskId,
        createdBy: session.user.id,
      },
    })

    // ActivityLog (best-effort, don't block on failure)
    try {
      await prisma.activityLog.create({
        data: {
          actorId: session.user.id,
          entity: 'taskLink',
          entityId: link.id,
          action: 'create',
          after: {
            taskId: link.taskId,
            linkedTaskId: link.linkedTaskId,
          },
        },
      })
    } catch (logErr) {
      console.warn('ActivityLog create failed:', logErr)
    }

    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    console.error('POST /api/tasks/[id]/links error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
