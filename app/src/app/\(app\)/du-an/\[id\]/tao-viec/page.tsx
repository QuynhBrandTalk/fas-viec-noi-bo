import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CreateTaskForm } from '../CreateTaskForm'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default async function CreateTaskPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) return null

  // MEMBER không được tạo task
  if (session.user.role === 'MEMBER') {
    notFound()
  }

  // Verify project tồn tại
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, departmentId: true, deletedAt: true },
  })

  if (!project || project.deletedAt) {
    notFound()
  }

  // RBAC: MANAGER chỉ tạo task trong phòng ban của mình
  if (session.user.role === 'MANAGER' && project.departmentId !== session.user.departmentId) {
    notFound()
  }

  // Fetch users trong phòng ban
  const users = await prisma.user.findMany({
    where: {
      departmentId: project.departmentId,
      active: true,
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/du-an/${params.id}`} className="text-blue-600 hover:underline text-sm mb-2 inline-block">
          ← Quay lại
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Tạo việc</h1>
        <p className="text-sm text-gray-500">{project.name}</p>
      </div>

      <CreateTaskForm projectId={params.id} users={users} />
    </div>
  )
}
