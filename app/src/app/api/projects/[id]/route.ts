import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import {
  badRequest,
  dateString,
  forbidden,
  json,
  logActivity,
  notFound,
  readJson,
  serverError,
  unauthorized,
} from '@/lib/api'

type Ctx = { params: { id: string } }

async function findProject(id: string) {
  return prisma.project.findFirst({
    where: { id, deletedAt: null },
    include: { department: { select: { id: true, name: true } } },
  })
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const project = await findProject(params.id)
    if (!project) return notFound()
    return json(project)
  } catch (err) {
    return serverError('GET /api/projects/[id]', err)
  }
}

const UpdateProject = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
})

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const project = await findProject(params.id)
    if (!project) return notFound()
    if (!can(user, 'project:update', { departmentId: project.departmentId })) return forbidden()

    const parsed = UpdateProject.safeParse(await readJson(req))
    if (!parsed.success) return badRequest('Dữ liệu không hợp lệ', parsed.error.flatten())
    const startDate = parsed.data.startDate ?? project.startDate
    const endDate = parsed.data.endDate ?? project.endDate
    if (endDate < startDate) return badRequest('Ngày kết thúc không được trước ngày bắt đầu')

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { name: parsed.data.name ?? project.name, startDate, endDate },
      include: { department: { select: { id: true, name: true } } },
    })
    await logActivity({
      actorId: user.id,
      entity: 'project',
      entityId: project.id,
      action: 'update',
      before: { name: project.name, startDate: project.startDate.toISOString(), endDate: project.endDate.toISOString() },
      after: { name: updated.name, startDate: updated.startDate.toISOString(), endDate: updated.endDate.toISOString() },
    })
    return json(updated)
  } catch (err) {
    return serverError('PATCH /api/projects/[id]', err)
  }
}

// Xoá mềm — chỉ ADMIN (theo kiến trúc)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const project = await findProject(params.id)
    if (!project) return notFound()
    if (!can(user, 'project:delete', { departmentId: project.departmentId })) return forbidden()

    const now = new Date()
    await prisma.$transaction([
      prisma.project.update({ where: { id: project.id }, data: { deletedAt: now } }),
      prisma.task.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } }),
    ])
    await logActivity({ actorId: user.id, entity: 'project', entityId: project.id, action: 'delete' })
    return json({ ok: true })
  } catch (err) {
    return serverError('DELETE /api/projects/[id]', err)
  }
}
