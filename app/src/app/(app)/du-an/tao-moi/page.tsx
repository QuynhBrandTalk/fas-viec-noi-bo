import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ProjectForm from '@/components/ProjectForm'

export default async function TaoDuAnPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const allowed = user.role === 'ADMIN' || (user.role === 'MANAGER' && !!user.departmentId)
  if (!allowed) {
    return (
      <div className="space-y-4">
        <Link href="/du-an" className="text-sm text-blue-700 hover:underline">← Dự án</Link>
        <p className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Bạn không có quyền tạo dự án.</p>
      </div>
    )
  }

  const departments = await prisma.department.findMany({
    where: { active: true, ...(user.role === 'MANAGER' && { id: user.departmentId! }) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-4">
      <Link href="/du-an" className="text-sm text-blue-700 hover:underline">← Dự án</Link>
      <h1 className="text-lg font-semibold">Tạo dự án</h1>
      <ProjectForm mode="create" departments={departments} />
    </div>
  )
}
