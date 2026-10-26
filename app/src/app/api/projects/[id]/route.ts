import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import {
  badRequest,
  dateString,
  diffFields,
  forbidden,
  guardMutation,
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
  const blocked = guardMutation(req)
  if (blocked) return blocked
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const project = await findProject(params.id)
    if (!project) return notFound()
    if (!can(user, 'project:update', { departmentId: project.departmentId })) return forbidden()

    const parsed = UpdateProject.safeParse(await readJson(req))
    if (!parsed.success) return badRequest('Dữ liệu không hợp lệ', parsed.error.flatten())
    const input = parsed.data
    const startDate = input.startDate ?? project.startDate
    const endDate = input.endDate ?? project.endDate
    if (endDate < startDate) return badRequest('Ngày kết thúc không được trước ngày bắt đầu')

    // Chỉ ghi các trường có trong yêu cầu
    const data = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.project.update({
        where: { id: project.id },
        data,
        include: { department: { select: { id: true, name: true } } },
      })
      const diff = diffFields(project, data)
      if (diff) await logActivity(tx, { actorId: user.id, entity: 'project', entityId: project.id, action: 'update', ...diff })
      return row
    })
    return json(updated)
  } catch (err) {
    return serverError('PATCH /api/projects/[id]', err)
  }
}

// Xoá mềm — chỉ ADMIN (theo kiến trúc). Xoá dự án thì xoá mềm luôn các việc của dự án.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const blocked = guardMutation(req)
  if (blocked) return blocked
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const project = await findProject(params.id)
    if (!project) return notFound()
    if (!can(user, 'project:delete', { departmentId: project.departmentId })) return forbidden()

    const now = new Date()
    await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data: { deletedAt: now } })
      const tasks = await tx.task.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } })
      await logActivity(tx, {
        actorId: user.id,
        entity: 'project',
        entityId: project.id,
        action: 'delete',
        after: { tasksDeleted: tasks.count },
      })
    })
    return json({ ok: true })
  } catch (err) {
    return serverError('DELETE /api/projects/[id]', err)
  }
}
