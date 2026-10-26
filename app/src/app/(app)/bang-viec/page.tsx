import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can, STATUS_LABELS } from '@/lib/rbac'
import DueBadge from '@/components/DueBadge'
import TaskStatusSelect from '@/components/TaskStatusSelect'

const COLUMNS = ['TODO', 'DOING', 'DONE'] as const

export default async function BangViecPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const user = await getCurrentUser()
  if (!user) return null

  const projectId = searchParams.projectId || undefined
  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.task.findMany({
      where: { deletedAt: null, project: { deletedAt: null }, ...(projectId ? { projectId: projectId } : {}) },
      include: {
        owner: { select: { fullName: true } },
        project: { select: { id: true, name: true, departmentId: true } },
        department: { select: { name: true } },
      },
      orderBy: [{ dueDate: 'asc' }],
      take: 300,
    }),
  ])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-semibold">Bảng việc</h1>
        <form className="flex items-end gap-2" method="get">
          <label className="text-sm">
            <span className="block text-xs text-gray-500 mb-1">Dự án</span>
            <select name="projectId" defaultValue={projectId ?? ''} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
              <option value="">Tất cả dự án</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
            Lọc
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col)
          return (
            <section key={col} className="bg-gray-100 rounded-xl p-3 space-y-2" aria-label={STATUS_LABELS[col]}>
              <h2 className="text-sm font-semibold flex justify-between px-1">
                {STATUS_LABELS[col]} <span className="text-gray-500 font-normal">{items.length}</span>
              </h2>
              {items.map((t) => (
                <article key={t.id} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                  <p className="text-sm font-medium">{t.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <Link href={`/du-an/${t.project.id}`} className="hover:underline">
                      {t.project.name}
                    </Link>
                    {t.department && <span>· {t.department.name}</span>}
                  </div>
                  {t.owner ? (
                    <p className="text-xs text-gray-600">Phụ trách: {t.owner.fullName}</p>
                  ) : (
                    <p className="text-xs font-medium text-red-600">Chưa có người phụ trách</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <DueBadge dueDate={t.dueDate} status={t.status} />
                    <TaskStatusSelect
                      taskId={t.id}
                      taskTitle={t.title}
                      status={t.status}
                      canEdit={can(user, 'task:update', { departmentId: t.project.departmentId, ownerId: t.ownerId })}
                    />
                  </div>
                </article>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
