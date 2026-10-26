import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { isValidUrl } from '@/lib/utils'
import {
  badRequest,
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
    select: { id: true, ownerId: true, project: { select: { departmentId: true } } },
  })
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const task = await findTask(params.id)
    if (!task) return notFound()

    const links = await prisma.taskLink.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'asc' } })
    // Ẩn liên kết trỏ tới việc đã bị xoá mềm
    const linkedIds = links.map((l) => l.linkedTaskId).filter((v): v is string => !!v)
    const alive = new Set(
      (
        await prisma.task.findMany({
          where: { id: { in: linkedIds }, deletedAt: null, project: { deletedAt: null } },
          select: { id: true },
        })
      ).map((t) => t.id),
    )
    return json({ data: links.filter((l) => !l.linkedTaskId || alive.has(l.linkedTaskId)) })
  } catch (err) {
    return serverError('GET /api/tasks/[id]/links', err)
  }
}

// Một link là: tài liệu (title + url https://) HOẶC liên kết tới việc khác (linkedTaskId)
const CreateLink = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    url: z.string().trim().max(2000).optional(),
    linkedTaskId: z.string().min(1).optional(),
  })
  .refine((v) => !!v.url !== !!v.linkedTaskId, 'Cần đúng một trong hai: url hoặc linkedTaskId')

export async function POST(req: NextRequest, { params }: Ctx) {
  const blocked = guardMutation(req)
  if (blocked) return blocked
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const task = await findTask(params.id)
    if (!task) return notFound()
    if (!can(user, 'task:update', { departmentId: task.project.departmentId, ownerId: task.ownerId })) {
      return forbidden()
    }

    const parsed = CreateLink.safeParse(await readJson(req))
    if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ')
    const { title, url, linkedTaskId } = parsed.data

    // Đặc tả M3: chỉ nhận https:// — từ chối http:, javascript:, ...
    if (url && !isValidUrl(url)) return badRequest('Link phải bắt đầu bằng https://')

    if (linkedTaskId) {
      if (linkedTaskId === task.id) return badRequest('Không thể liên kết việc với chính nó')
      const other = await findTask(linkedTaskId)
      if (!other) return badRequest('Việc được liên kết không tồn tại')
      const dup = await prisma.taskLink.findFirst({ where: { taskId: task.id, linkedTaskId } })
      if (dup) return badRequest('Liên kết này đã tồn tại')
    }

    const link = await prisma.$transaction(async (tx) => {
      const created = await tx.taskLink.create({
        data: { taskId: task.id, title: title ?? null, url: url ?? null, linkedTaskId: linkedTaskId ?? null, createdBy: user.id },
      })
      await logActivity(tx, {
        actorId: user.id,
        entity: 'task_link',
        entityId: created.id,
        action: 'create',
        after: { taskId: task.id, title: title ?? null, url: url ?? null, linkedTaskId: linkedTaskId ?? null },
      })
      return created
    })
    return json(link, 201)
  } catch (err) {
    return serverError('POST /api/tasks/[id]/links', err)
  }
}
