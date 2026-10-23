import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/rbac'
import type { Role } from '@prisma/client'
import InviteUserForm from './InviteUserForm'

export default async function NguoiDungPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/hom-nay')
  }

  const users = await prisma.user.findMany({
    include: { department: { select: { name: true } } },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  })

  const departments = await prisma.department.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Người dùng</h1>
          <p className="text-sm text-gray-500">{users.length} tài khoản</p>
        </div>
      </div>

      <InviteUserForm departments={departments} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Họ tên</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vai trò</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bộ phận</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Đăng nhập lần cuối</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{user.fullName}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3 text-gray-600">{user.department?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400">{formatDate(user.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    user.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {user.active ? 'Hoạt động' : 'Đã vô hiệu'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
    ADMIN: 'bg-purple-50 text-purple-700',
    MANAGER: 'bg-blue-50 text-blue-700',
    MEMBER: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}
