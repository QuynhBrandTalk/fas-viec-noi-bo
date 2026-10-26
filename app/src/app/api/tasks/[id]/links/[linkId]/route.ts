import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { forbidden, json, logActivity, notFound, serverError, unauthorized } from '@/lib/api'

type Ctx = { params: { id: string; linkId: string } }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()

    const link = await prisma.taskLink.findFirst({
      where: { id: params.linkId, taskId: params.id },
      include: { task: { select: { ownerId: true, deletedAt: true, project: { select: { departmentId: true } } } } },
    })
    if (!link || link.task.deletedAt) return notFound()
    if (!can(user, 'task:update', { departmentId: link.task.project.departmentId, ownerId: link.task.ownerId })) {
      return forbidden()
    }

    await prisma.taskLink.delete({ where: { id: link.id } })
    await logActivity({ actorId: user.id, entity: 'task_link', entityId: link.id, action: 'delete' })
    return json({ ok: true })
  } catch (err) {
    return serverError('DELETE /api/tasks/[id]/links/[linkId]', err)
  }
}
