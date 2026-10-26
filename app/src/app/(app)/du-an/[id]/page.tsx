import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can, PRIORITY_LABELS } from '@/lib/rbac'
import { formatDate } from '@/lib/utils'
import DueBadge from '@/components/DueBadge'
import TaskStatusSelect from '@/components/TaskStatusSelect'

const LIMIT = 500

export default async function DuAnChiTietPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return null

  const project = await prisma.project.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { department: { select: { name: true } } },
  })
  if (!project) notFound()

  const tasks = await prisma.task.findMany({
    where: { projectId: project.id, deletedAt: null },
    include: { owner: { select: { fullName: true } } },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    take: LIMIT + 1,
  })
  const truncated = tasks.length > LIMIT
  if (truncated) tasks.length = LIMIT

  const resource = { departmentId: project.departmentId }
  const canEditProject = can(user, 'project:update', resource)
  const canCreateTask = can(user, 'task:create', resource)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/du-an" className="text-sm text-blue-700 hover:underline">← Dự án</Link>
          <h1 className="text-lg font-semibold mt-1">{project.name}</h1>
          <p className="text-sm text-gray-500">
            {project.department.name} · {formatDate(project.startDate)} → {formatDate(project.endDate)}
          </p>
        </div>
        <div className="flex gap-2">
          {canEditProject && (
            <Link href={`/du-an/${project.id}/chinh-sua`} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
              Sửa dự án
            </Link>
          )}
          {canCreateTask && (
            <Link href={`/du-an/${project.id}/tao-viec`} className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              + Tạo việc
            </Link>
          )}
        </div>
      </div>

      {truncated && (
        <p className="text-sm bg-amber-50 text-amber-900 border border-amber-200 rounded-lg px-3 py-2">
          Dự án có hơn {LIMIT} việc; đang hiển thị {LIMIT} việc có hạn sớm nhất.
        </p>
      )}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Dự án chưa có việc nào.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Việc</th>
                <th className="px-4 py-3 font-medium">Phụ trách</th>
                <th className="px-4 py-3 font-medium">Hạn</th>
                <th className="px-4 py-3 font-medium">Ưu tiên</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3">
                    {t.owner ? t.owner.fullName : <span className="text-red-600 font-medium">Chưa có người phụ trách</span>}
                  </td>
                  <td className="px-4 py-3"><DueBadge dueDate={t.dueDate} status={t.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{PRIORITY_LABELS[t.priority]}</td>
                  <td className="px-4 py-3">
                    <TaskStatusSelect
                      taskId={t.id}
                      taskTitle={t.title}
                      status={t.status}
                      canEdit={can(user, 'task:update', { departmentId: project.departmentId, ownerId: t.ownerId })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
