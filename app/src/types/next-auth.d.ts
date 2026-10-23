import type { Role } from '@prisma/client'
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
      departmentId?: string
    }
  }

  interface User {
    id: string
    role?: Role
    departmentId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role
    departmentId?: string
  }
}
