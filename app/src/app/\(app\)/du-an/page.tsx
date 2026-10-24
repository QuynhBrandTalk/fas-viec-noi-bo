import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function DuAnPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const page = parseInt(searchParams.page || '1', 10)
  const status = (searchParams.status as 'ACTIVE' | 'ARCHIVED' | undefined) || 'ACTIVE'
  const limit = 50

  // Fetch projects (gọi API hoặc direct Prisma — direct Prisma đơn giản hơn)
  let filter: any = { status }

  if (session.user.role === 'MEMBER') {
    // MEMBER không xem được project list
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Dự án</h1>
        <p className="text-sm text-gray-500">Bạn không có quyền xem danh sách dự án.</p>
      </div>
    )
  }

  if (session.user.role === 'MANAGER') {
    filter.departmentId = session.user.departmentId
  }

  const skip = (page - 1) * limit
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: filter,
      include: { department: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.project.count({ where: filter }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dự án</h1>
          <p className="text-sm text-gray-500">Quản lý các dự án</p>
        </div>
        <Link
          href="/du-an/tao-moi"
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + Tạo dự án
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Không có dự án nào.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Tên dự án</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Bộ phận</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Ngày bắt đầu</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Ngày kết thúc</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Trạng thái</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/du-an/${project.id}`} className="text-blue-600 hover:underline font-medium">
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{project.department.name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(project.startDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(project.endDate)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          project.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {project.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/du-an/${project.id}/chinh-sua`} className="text-blue-600 hover:underline text-xs">
                        Sửa
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Trang {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/du-an?page=${page - 1}&status=${status}`}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
                  >
                    Trước
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/du-an?page=${page + 1}&status=${status}`}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
                  >
                    Tiếp
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
