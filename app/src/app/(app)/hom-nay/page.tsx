import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'

export default async function HomNayPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const today = new Date(new Date().toLocaleString('en', { timeZone: 'Asia/Ho_Chi_Minh' }))
  today.setHours(0, 0, 0, 0)
  const in7Days = new Date(today)
  in7Days.setDate(today.getDate() + 7)

  const tasks = await prisma.task.findMany({
    where: {
      ownerId: session.user.id,
      status: { not: 'DONE' },
      deletedAt: null,
    },
    include: {
      project: { select: { name: true } },
    },
    orderBy: { dueDate: 'asc' },
  })

  const overdue = tasks.filter((t) => new Date(t.dueDate) < today)
  const todayTasks = tasks.filter(
    (t) => new Date(t.dueDate) >= today && new Date(t.dueDate) <= today
  )
  const upcoming = tasks.filter(
    (t) => new Date(t.dueDate) > today && new Date(t.dueDate) <= in7Days
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Hôm nay</h1>
        <p className="text-sm text-gray-500">
          {today.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Không có việc nào được giao cho bạn.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <TaskGroup label="Quá hạn" tasks={overdue} variant="overdue" />
          <TaskGroup label="Hôm nay" tasks={todayTasks} variant="today" />
          <TaskGroup label="7 ngày tới" tasks={upcoming} variant="upcoming" />
        </div>
      )}
    </div>
  )
}

function TaskGroup({
  label,
  tasks,
  variant,
}: {
  label: string
  tasks: Array<{ id: string; title: string; dueDate: Date; priority: string; project: { name: string } }>
  variant: 'overdue' | 'today' | 'upcoming'
}) {
  if (tasks.length === 0) return null

  const colors = {
    overdue: 'text-red-700 bg-red-50 border-red-100',
    today: 'text-blue-700 bg-blue-50 border-blue-100',
    upcoming: 'text-gray-700 bg-gray-50 border-gray-100',
  }

  return (
    <div>
      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium mb-2 border ${colors[variant]}`}>
        {label} · {tasks.length}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">{task.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{task.project.name}</p>
            </div>
            <div className="text-xs text-gray-400 text-right">
              <p>{formatDate(task.dueDate)}</p>
              <PriorityBadge priority={task.priority} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'HIGH') return <span className="text-red-500 font-medium">Cao</span>
  if (priority === 'LOW') return <span className="text-gray-400">Thấp</span>
  return null
}
