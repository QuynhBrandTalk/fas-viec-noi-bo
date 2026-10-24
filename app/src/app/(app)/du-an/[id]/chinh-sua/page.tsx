import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EditProjectForm } from '../EditProjectForm'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default async function EditProjectPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) return null

  // MEMBER không được edit
  if (session.user.role === 'MEMBER') {
    notFound()
  }

  // Verify project tồn tại
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, departmentId: true, startDate: true, endDate: true, deletedAt: true },
  })

  if (!project || project.deletedAt) {
    notFound()
  }

  // RBAC: MANAGER chỉ edit dự án của phòng ban mình
  if (session.user.role === 'MANAGER' && project.departmentId !== session.user.departmentId) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/du-an/${params.id}`} className="text-blue-600 hover:underline text-sm mb-2 inline-block">
          ← Quay lại
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Chỉnh sửa dự án</h1>
        <p className="text-sm text-gray-500">{project.name}</p>
      </div>

      <EditProjectForm
        project={{
          id: project.id,
          name: project.name,
          startDate: project.startDate.toISOString(),
          endDate: project.endDate.toISOString(),
          departmentId: project.departmentId,
        }}
      />
    </div>
  )
}
