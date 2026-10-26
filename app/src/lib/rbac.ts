import type { Role } from '@prisma/client'

/**
 * Ma trận quyền theo kiến trúc (bảng "Đăng nhập và phân quyền"):
 *
 * | Vai trò    | Xem việc | Sửa việc        | Quản lý người dùng | Xoá việc |
 * |------------|----------|-----------------|--------------------|----------|
 * | ADMIN      | Tất cả   | Tất cả          | Có                 | Có       |
 * | MANAGER    | Tất cả   | Bộ phận mình    | Không              | Không    |
 * | MEMBER     | Tất cả   | Việc được giao  | Không              | Không    |
 *
 * Luôn gọi phía server. Không tin kết quả từ client.
 */

export interface Actor {
  id: string
  role: Role
  departmentId: string | null
}

export interface Resource {
  departmentId?: string | null
  ownerId?: string | null
}

export type Action =
  | 'project:read'
  | 'project:create'
  | 'project:update'
  | 'project:delete'
  | 'task:read'
  | 'task:create'
  | 'task:update'
  | 'task:assign'
  | 'task:delete'
  | 'user:read'
  | 'user:manage'

export function can(actor: Actor, action: Action, resource: Resource = {}): boolean {
  if (actor.role === 'ADMIN') return true

  const sameDept = !!actor.departmentId && resource.departmentId === actor.departmentId
  const isManager = actor.role === 'MANAGER'

  switch (action) {
    case 'project:read':
    case 'task:read':
      return true

    case 'project:create':
    case 'project:update':
    case 'task:create':
    case 'task:assign':
      return isManager && sameDept

    case 'task:update':
      // Quản lý sửa mọi việc của bộ phận mình; ai cũng sửa được việc mình phụ trách
      if (isManager && sameDept) return true
      return !!resource.ownerId && resource.ownerId === actor.id

    case 'user:read':
      return isManager

    case 'project:delete':
    case 'task:delete':
    case 'user:manage':
      return false

    default:
      return false
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  MEMBER: 'Thành viên',
}

export const STATUS_LABELS = {
  TODO: 'Chưa làm',
  DOING: 'Đang làm',
  DONE: 'Hoàn thành',
} as const

export const PRIORITY_LABELS = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Cao',
} as const
