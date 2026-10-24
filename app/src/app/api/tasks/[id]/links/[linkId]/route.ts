import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: { id: string; linkId: string }
}

// ─── DELETE /api/tasks/[id]/links/[linkId] ────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify link exists and belongs to this task
    const link = await prisma.taskLink.findUnique({
      where: { id: params.linkId },
      select: { id: true, taskId: true, linkedTaskId: true },
    })

    if (!link || link.taskId !== params.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Get source task
    const sourceTask = await prisma.task.findUnique({
      where: { id: params.id },
      select: { projectId: true, ownerId: true },
    })

    if (!sourceTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
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

    // Delete link
    await prisma.taskLink.delete({
      where: { id: params.linkId },
    })

    // ActivityLog (best-effort, don't block on failure)
    try {
      await prisma.activityLog.create({
        data: {
          actorId: session.user.id,
          entity: 'taskLink',
          entityId: params.linkId,
          action: 'delete',
          before: {
            taskId: link.taskId,
            linkedTaskId: link.linkedTaskId,
          },
        },
      })
    } catch (logErr) {
      console.warn('ActivityLog create failed:', logErr)
    }

    return NextResponse.json({ message: 'Link deleted' })
  } catch (error) {
    console.error('DELETE /api/tasks/[id]/links/[linkId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
