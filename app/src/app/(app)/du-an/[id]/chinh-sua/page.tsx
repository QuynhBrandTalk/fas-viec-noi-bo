import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { dayKey } from '@/lib/dates'
import ProjectForm from '@/components/ProjectForm'

export default async function SuaDuAnPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return null

  const project = await prisma.project.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, name: true, departmentId: true, startDate: true, endDate: true },
  })
  if (!project) notFound()

  if (!can(user, 'project:update', { departmentId: project.departmentId })) {
    return (
      <div className="space-y-4">
        <Link href={`/du-an/${project.id}`} className="text-sm text-blue-700 hover:underline">← {project.name}</Link>
        <p className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Bạn không có quyền sửa dự án này.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link href={`/du-an/${project.id}`} className="text-sm text-blue-700 hover:underline">← {project.name}</Link>
      <h1 className="text-lg font-semibold">Sửa dự án</h1>
      <ProjectForm
        mode="edit"
        departments={[]}
        initial={{
          id: project.id,
          name: project.name,
          departmentId: project.departmentId,
          startDate: dayKey(project.startDate),
          endDate: dayKey(project.endDate),
        }}
      />
    </div>
  )
}
