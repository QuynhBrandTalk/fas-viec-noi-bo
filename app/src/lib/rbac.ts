import type { Role } from '@prisma/client'

export interface PermissionContext {
  role: Role
  departmentId?: string | null
  userId?: string | null  // dùng để check MEMBER chỉ sửa task của mình
}

export interface ResourceContext {
  departmentId?: string | null
  ownerId?: string | null   // người được giao task
  createdBy?: string | null // người tạo
}

type Action =
  | 'user:read'
  | 'user:create'
  | 'user:update'
  | 'user:deactivate'
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:delete'
  | 'task:create'
  | 'task:read'
  | 'task:update'
  | 'task:delete'
  | 'report:read'

/**
 * Kiểm tra quyền phía server — luôn gọi trong Server Component / Route Handler,
 * không bao giờ tin kết quả từ client.
 *
 * ADMIN   : toàn quyền
 * MANAGER : quản lý trong phòng ban của mình
 * MEMBER  : chỉ xem + sửa task được giao cho mình
 */
export function can(
  user: PermissionContext,
  action: Action,
  resource?: ResourceContext,
): boolean {
  const { role, departmentId, userId } = user

  if (role === 'ADMIN') return true

  switch (action) {
    // ── Người dùng ──────────────────────────────────────────────────────────
    case 'user:read':
      return role === 'MANAGER'
    case 'user:create':
    case 'user:update':
    case 'user:deactivate':
      return false // Chỉ ADMIN

    // ── Dự án ────────────────────────────────────────────────────────────────
    case 'project:read':
      return true // Tất cả đều xem được
    case 'project:create':
      return role === 'MANAGER'
    case 'project:update':
    case 'project:delete':
      // MANAGER chỉ sửa/xóa dự án trong phòng ban của mình
      return role === 'MANAGER' && resource?.departmentId === departmentId

    // ── Công việc ─────────────────────────────────────────────────────────────
    case 'task:read':
      return true // Tất cả đều xem được
    case 'task:create':
      return role === 'MANAGER'
    case 'task:update':
      if (role === 'MANAGER') {
        // MANAGER sửa task trong phòng ban mình
        return resource?.departmentId === departmentId
      }
      // MEMBER chỉ sửa task được giao cho mình
      return (
        resource?.ownerId === userId ||
        resource?.createdBy === userId
      )
    case 'task:delete':
      // MANAGER xóa task trong phòng ban mình
      return role === 'MANAGER' && resource?.departmentId === departmentId

    // ── Báo cáo ──────────────────────────────────────────────────────────────
    case 'report:read':
      return role === 'MANAGER'

    default:
      return false
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  MEMBER: 'Thành viên',
}
