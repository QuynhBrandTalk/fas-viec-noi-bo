import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDays, dayKey, vnToday } from '@/lib/dates'
import { can } from '@/lib/rbac'
import DueBadge from '@/components/DueBadge'
import TaskStatusSelect from '@/components/TaskStatusSelect'

export default async function HomNayPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const tasks = await prisma.task.findMany({
    where: { ownerId: user.id, status: { not: 'DONE' }, deletedAt: null, project: { deletedAt: null } },
    include: { project: { select: { id: true, name: true, departmentId: true } } },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  })

  const today = vnToday()
  const in7 = addDays(today, 7)
  const overdue = tasks.filter((t) => dayKey(t.dueDate) < today)
  const dueToday = tasks.filter((t) => dayKey(t.dueDate) === today)
  const soon = tasks.filter((t) => dayKey(t.dueDate) > today && dayKey(t.dueDate) <= in7)
  const later = tasks.filter((t) => dayKey(t.dueDate) > in7)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Chào {user.name}</h1>
        <p className="text-sm text-gray-500">
          Bạn có {overdue.length + dueToday.length} việc cần xử lý hôm nay ({overdue.length} quá hạn).
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Quá hạn" value={overdue.length} danger />
        <Tile label="Đến hạn hôm nay" value={dueToday.length} />
        <Tile label="Trong 7 ngày tới" value={soon.length} />
        <Tile label="Đang mở" value={tasks.length} />
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Chưa có việc nào được giao cho bạn.
        </div>
      ) : (
        <div className="space-y-5">
          <Group title="Quá hạn" tasks={overdue} user={user} />
          <Group title="Hôm nay" tasks={dueToday} user={user} />
          <Group title="7 ngày tới" tasks={soon} user={user} />
          <Group title="Sau đó" tasks={later} user={user} />
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`text-2xl font-bold ${danger && value > 0 ? 'text-red-600' : ''}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}

type Row = {
  id: string
  title: string
  status: string
  dueDate: Date
  ownerId: string | null
  project: { id: string; name: string; departmentId: string }
}

function Group({
  title,
  tasks,
  user,
}: {
  title: string
  tasks: Row[]
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
}) {
  if (tasks.length === 0) return null
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">
        {title} · {tasks.length}
      </h2>
      <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {tasks.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              <Link href={`/du-an/${t.project.id}`} className="text-xs text-gray-500 hover:underline">
                {t.project.name}
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <DueBadge dueDate={t.dueDate} status={t.status} />
              <TaskStatusSelect
                taskId={t.id}
                taskTitle={t.title}
                status={t.status}
                canEdit={can(user, 'task:update', { departmentId: t.project.departmentId, ownerId: t.ownerId })}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
