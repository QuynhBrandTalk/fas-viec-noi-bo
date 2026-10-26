import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import TaskForm from '@/components/TaskForm'

export default async function TaoViecPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return null

  const project = await prisma.project.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, name: true, departmentId: true },
  })
  if (!project) notFound()

  if (!can(user, 'task:create', { departmentId: project.departmentId })) {
    return (
      <div className="space-y-4">
        <Link href={`/du-an/${project.id}`} className="text-sm text-blue-700 hover:underline">← {project.name}</Link>
        <p className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Bạn không có quyền tạo việc trong dự án này.</p>
      </div>
    )
  }

  // Có thể giao cho người bộ phận khác (bàn giao chéo bộ phận)
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })

  return (
    <div className="space-y-4">
      <Link href={`/du-an/${project.id}`} className="text-sm text-blue-700 hover:underline">← {project.name}</Link>
      <h1 className="text-lg font-semibold">Tạo việc</h1>
      <TaskForm projectId={project.id} users={users} />
    </div>
  )
}
