import type { Role } from '@prisma/client'

export type Action =
  | 'task:create'
  | 'task:read'
  | 'task:update'
  | 'task:delete'
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'dependency:create'
  | 'dependency:delete'
  | 'user:invite'
  | 'user:manage'
  | 'report:read'
  | 'report:read:all'

interface PermissionContext {
  role: Role
  departmentId?: string | null
}

interface ResourceContext {
  departmentId?: string | null
  ownerId?: string | null
  userId?: string | null
}

export function can(
  user: PermissionContext,
  action: Action,
  resource?: ResourceContext
): boolean {
  const { role, departmentId } = user

  switch (role) {
    case 'ADMIN':
      // Admin được tất cả
      return true

    case 'MANAGER':
      switch (action) {
        case 'task:create':
        case 'task:read':
        case 'project:create':
        case 'project:read':
        case 'dependency:create':
        case 'dependency:delete':
          return true
        case 'task:update':
          // Sửa việc trong bộ phận mình
          return !resource?.departmentId || resource.departmentId === departmentId
        case 'project:update':
          return !resource?.departmentId || resource.departmentId === departmentId
        case 'report:read':
          return true
        case 'report:read:all':
          return false
        case 'task:delete':
        case 'user:invite':
        case 'user:manage':
          return false
        default:
          return false
      }

    case 'MEMBER':
      switch (action) {
        case 'task:read':
        case 'project:read':
        case 'report:read':
          return true
        case 'task:create':
          // Chỉ tạo việc của chính mình
          return true
        case 'task:update':
          // Chỉ sửa việc được giao cho mình
          return resource?.ownerId === user.userId || resource?.userId === user.userId
        default:
          return false
      }

    default:
      return false
  }
}

// Helper cho API routes
export function requireRole(userRole: Role, minRole: Role): boolean {
  const hierarchy: Role[] = ['MEMBER', 'MANAGER', 'ADMIN']
  return hierarchy.indexOf(userRole) >= hierarchy.indexOf(minRole)
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  MEMBER: 'Thành viên',
}
