import { dueState, type DueState } from '@/lib/dates'
import { formatDate } from '@/lib/utils'

const STYLES: Record<DueState, string> = {
  overdue: 'bg-red-50 text-red-700',
  today: 'bg-amber-50 text-amber-800',
  soon: 'bg-gray-100 text-gray-700',
  later: 'bg-gray-50 text-gray-500',
  done: 'bg-green-50 text-green-700',
}

export default function DueBadge({ dueDate, status }: { dueDate: Date; status: string }) {
  const state = dueState(dueDate, status)
  const label = state === 'overdue' ? `Quá hạn · ${formatDate(dueDate)}` : state === 'today' ? 'Hôm nay' : formatDate(dueDate)
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${STYLES[state]}`}>{label}</span>
}
