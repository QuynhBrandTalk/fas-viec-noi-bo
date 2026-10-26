import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status })
export const unauthorized = () => json({ error: 'Chưa đăng nhập' }, 401)
export const forbidden = () => json({ error: 'Không có quyền' }, 403)
export const notFound = () => json({ error: 'Không tìm thấy' }, 404)
export const badRequest = (error: string, details?: unknown) => json({ error, details }, 400)
export const serverError = (where: string, err: unknown) => {
  console.error(`[${where}]`, err)
  return json({ error: 'Lỗi hệ thống' }, 500)
}

/** Ngày dạng YYYY-MM-DD (input type="date") hoặc ISO đầy đủ. Lưu theo ngày (cột @db.Date). */
export const dateString = z
  .string()
  .refine((s) => /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s)), 'Ngày không hợp lệ')
  .transform((s) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`))

/** Số ngày tính cả ngày đầu và ngày cuối. */
export function durationDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

/** Ghi nhật ký hoạt động. Không làm hỏng thao tác chính nếu ghi log lỗi. */
export async function logActivity(entry: {
  actorId: string
  entity: string
  entityId: string
  action: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}) {
  try {
    await prisma.activityLog.create({ data: entry })
  } catch (err) {
    console.warn('[activity_log] ghi thất bại', err)
  }
}

/** Đọc body JSON an toàn: body hỏng trả về null thay vì ném lỗi 500. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
