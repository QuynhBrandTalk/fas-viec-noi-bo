import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default async function DuAnDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) return null

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      department: { select: { id: true, name: true } },
    },
  })

  if (!project) notFound()

  // RBAC: MEMBER không xem được
  if (session.user.role === 'MEMBER') {
    notFound()
  }
  // MANAGER chỉ xem phòng ban của mình
  if (session.user.role === 'MANAGER' && project.departmentId !== session.user.departmentId) {
    notFound()
  }

  // Fetch tasks của dự án này
  const tasks = await prisma.task.findMany({
    where: {
      projectId: project.id,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      owner: { select: { fullName: true } },
    },
    orderBy: { dueDate: 'asc' },
  })

  const isOwner = project.ownerId === session.user.id
  const canEdit = isOwner || session.user.role === 'ADMIN'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/du-an" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{project.department.name}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Link
              href={`/du-an/${project.id}/chinh-sua`}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Sửa
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Ngày bắt đầu</p>
          <p className="font-semibold text-gray-900">{formatDate(project.startDate)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Ngày kết thúc</p>
          <p className="font-semibold text-gray-900">{formatDate(project.endDate)}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Việc cần làm</h2>
          <Link
            href={`/du-an/${project.id}/tao-viec`}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            + Tạo việc
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">Không có việc nào trong dự án này.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Tiêu đề</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Người thực hiện</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Ngày</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Ưu tiên</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/du-an/${project.id}/viec/${task.id}`} className="text-blue-600 hover:underline">
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{task.owner?.fullName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(task.dueDate)}</td>
                    <td className="px-4 py-3">
                      {task.priority === 'HIGH' && <span className="text-red-600 font-medium">Cao</span>}
                      {task.priority === 'NORMAL' && <span className="text-gray-600">Trung bình</span>}
                      {task.priority === 'LOW' && <span className="text-gray-400">Thấp</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          task.status === 'DONE'
                            ? 'bg-green-100 text-green-800'
                            : task.status === 'DOING'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {task.status === 'DONE' ? 'Xong' : task.status === 'DOING' ? 'Đang làm' : 'Chưa làm'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
