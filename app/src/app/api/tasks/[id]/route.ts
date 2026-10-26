import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import {
  badRequest,
  dateString,
  diffFields,
  durationDays,
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

async function findTask(id: string) {
  return prisma.task.findFirst({
    where: { id, deletedAt: null, project: { deletedAt: null } },
    include: {
      project: { select: { id: true, name: true, departmentId: true } },
      owner: { select: { id: true, fullName: true } },
    },
  })
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const task = await findTask(params.id)
    if (!task) return notFound()
    return json(task)
  } catch (err) {
    return serverError('GET /api/tasks/[id]', err)
  }
}

const UpdateTask = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['TODO', 'DOING', 'DONE']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  ownerId: z.string().min(1).nullable().optional(),
  startDate: dateString.optional(),
  dueDate: dateString.optional(),
})

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const blocked = guardMutation(req)
  if (blocked) return blocked
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const task = await findTask(params.id)
    if (!task) return notFound()

    const resource = { departmentId: task.project.departmentId, ownerId: task.ownerId }
    if (!can(user, 'task:update', resource)) return forbidden()

    const parsed = UpdateTask.safeParse(await readJson(req))
    if (!parsed.success) return badRequest('Dữ liệu không hợp lệ', parsed.error.flatten())
    const input = parsed.data

    // Đổi người phụ trách: chỉ ADMIN hoặc MANAGER của bộ phận
    if (input.ownerId !== undefined && input.ownerId !== task.ownerId) {
      if (!can(user, 'task:assign', resource)) return forbidden()
      if (input.ownerId) {
        const owner = await prisma.user.findFirst({ where: { id: input.ownerId, active: true }, select: { id: true } })
        if (!owner) return badRequest('Người phụ trách không hợp lệ')
      }
    }

    // Chỉ ghi ngày khi yêu cầu có gửi ngày — tránh ghi đè thay đổi của người khác
    const datesChanged = input.startDate !== undefined || input.dueDate !== undefined
    const startDate = input.startDate ?? task.startDate
    const dueDate = input.dueDate ?? task.dueDate
    if (datesChanged && dueDate < startDate) return badRequest('Hạn hoàn thành không được trước ngày bắt đầu')

    const progress = input.status === 'DONE' ? 100 : input.progress
    const data = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(progress !== undefined ? { progress } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(datesChanged ? { startDate, dueDate, durationDays: durationDays(startDate, dueDate) } : {}),
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.task.update({
        where: { id: task.id },
        data,
        include: {
          project: { select: { id: true, name: true } },
          owner: { select: { id: true, fullName: true } },
        },
      })
      const diff = diffFields(task, data)
      if (diff) await logActivity(tx, { actorId: user.id, entity: 'task', entityId: task.id, action: 'update', ...diff })
      return row
    })
    return json(updated)
  } catch (err) {
    return serverError('PATCH /api/tasks/[id]', err)
  }
}

// Xoá mềm — chỉ ADMIN (theo kiến trúc)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const blocked = guardMutation(req)
  if (blocked) return blocked
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const task = await findTask(params.id)
    if (!task) return notFound()
    if (!can(user, 'task:delete', { departmentId: task.project.departmentId, ownerId: task.ownerId })) {
      return forbidden()
    }
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } })
      await logActivity(tx, { actorId: user.id, entity: 'task', entityId: task.id, action: 'delete' })
    })
    return json({ ok: true })
  } catch (err) {
    return serverError('DELETE /api/tasks/[id]', err)
  }
}
