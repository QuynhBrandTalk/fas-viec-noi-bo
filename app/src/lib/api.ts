import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { appOrigin } from '@/lib/config'

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status })
export const unauthorized = () => json({ error: 'Chưa đăng nhập' }, 401)
export const forbidden = () => json({ error: 'Không có quyền' }, 403)
export const notFound = () => json({ error: 'Không tìm thấy' }, 404)
export const badRequest = (error: string, details?: unknown) => json({ error, details }, 400)
export const serverError = (where: string, err: unknown) => {
  console.error(`[${where}]`, err instanceof Error ? err.message : err)
  return json({ error: 'Lỗi hệ thống' }, 500)
}

/**
 * Chặn CSRF cho route thay đổi dữ liệu:
 * - POST/PATCH/PUT phải gửi Content-Type: application/json (form HTML không gửi được kiểu này
 *   sang site khác nếu không qua preflight CORS — mà app không bật CORS).
 * - Nếu trình duyệt gửi Origin thì phải trùng địa chỉ của app.
 * Trả về Response lỗi, hoặc null nếu hợp lệ.
 */
export function guardMutation(req: Request): Response | null {
  const method = req.method.toUpperCase()
  if (['POST', 'PATCH', 'PUT'].includes(method)) {
    const type = req.headers.get('content-type') ?? ''
    if (!type.toLowerCase().startsWith('application/json')) {
      return json({ error: 'Yêu cầu không hợp lệ' }, 415)
    }
  }
  const origin = req.headers.get('origin')
  if (origin && origin !== appOrigin()) {
    return json({ error: 'Yêu cầu không hợp lệ' }, 403)
  }
  return null
}

/**
 * Ngày dạng YYYY-MM-DD đúng tuyệt đối (2026-02-31 bị từ chối, không tự lùi sang tháng sau).
 * Lưu thành 00:00 UTC của ngày đó (cột @db.Date).
 */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, 'Ngày không tồn tại')
  .transform((s) => new Date(`${s}T00:00:00.000Z`))

/** Số ngày tính cả ngày đầu và ngày cuối. */
export function durationDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

export interface ActivityEntry {
  actorId: string
  entity: string
  entityId: string
  action: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}

/**
 * Ghi nhật ký hoạt động TRONG CÙNG transaction với thay đổi dữ liệu:
 * hoặc cả hai cùng thành công, hoặc cả hai cùng huỷ (đặc tả: mọi thay đổi đều được ghi).
 */
export function logActivity(tx: Prisma.TransactionClient, entry: ActivityEntry) {
  return tx.activityLog.create({ data: entry })
}

/** Chỉ giữ các trường đã thay đổi, để nhật ký có before/after đầy đủ mà gọn. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Prisma.InputJsonObject; after: Prisma.InputJsonObject } | null {
  const b: Record<string, Prisma.InputJsonValue | null> = {}
  const a: Record<string, Prisma.InputJsonValue | null> = {}
  for (const key of Object.keys(after)) {
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? null)) as Prisma.InputJsonValue | null
    if (JSON.stringify(norm(before[key])) !== JSON.stringify(norm(after[key]))) {
      b[key] = norm(before[key])
      a[key] = norm(after[key])
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null
}

/** Đọc body JSON an toàn: body hỏng trả về null thay vì ném lỗi 500. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
