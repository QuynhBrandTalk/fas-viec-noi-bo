import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'

const PAGE_SIZE = 50

export default async function DuAnPage({ searchParams }: { searchParams: { page?: string } }) {
  const user = await getCurrentUser()
  if (!user) return null

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const where = { deletedAt: null }
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        department: { select: { name: true } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.project.count({ where }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canCreate = user.role === 'ADMIN' || (user.role === 'MANAGER' && !!user.departmentId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Dự án</h1>
          <p className="text-sm text-gray-500">{total} dự án</p>
        </div>
        {canCreate && (
          <Link href="/du-an/tao-moi" className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            + Tạo dự án
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Chưa có dự án nào.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Tên dự án</th>
                <th className="px-4 py-3 font-medium">Bộ phận</th>
                <th className="px-4 py-3 font-medium">Bắt đầu</th>
                <th className="px-4 py-3 font-medium">Kết thúc</th>
                <th className="px-4 py-3 font-medium">Số việc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/du-an/${p.id}`} className="text-blue-700 hover:underline font-medium">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.department.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(p.startDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(p.endDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{p._count.tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/du-an?page=${page - 1}`} className="underline">Trang trước</Link>}
          <span className="text-gray-500">Trang {page}/{totalPages}</span>
          {page < totalPages && <Link href={`/du-an?page=${page + 1}`} className="underline">Trang sau</Link>}
        </div>
      )}
    </div>
  )
}
