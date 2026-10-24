import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CreateProjectForm } from '../CreateProjectForm'
import Link from 'next/link'

export default async function CreateProjectPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  // MEMBER không được tạo project
  if (session.user.role === 'MEMBER') {
    return (
      <div className="space-y-4">
        <div>
          <Link href="/du-an" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Quay lại
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Bạn không có quyền tạo dự án.</p>
        </div>
      </div>
    )
  }

  // Fetch departments
  const departments = await prisma.department.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/du-an" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
          ← Quay lại
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Tạo dự án</h1>
      </div>

      <CreateProjectForm
        departments={departments}
        userRole={session.user.role}
        userDepartmentId={session.user.departmentId}
      />
    </div>
  )
}
