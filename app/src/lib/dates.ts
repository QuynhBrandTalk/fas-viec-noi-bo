/**
 * Ngày làm việc tính theo giờ Việt Nam.
 * Cột start_date/due_date là kiểu DATE (Prisma trả về 00:00 UTC của ngày đó),
 * nên so sánh bằng chuỗi YYYY-MM-DD để tránh lệch múi giờ.
 */

const VN_TZ = 'Asia/Ho_Chi_Minh'

/** Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function vnToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Ngày của một cột DATE, dạng YYYY-MM-DD. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return dayKey(d)
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'done'

export function dueState(dueDate: Date, status: string, today: string = vnToday()): DueState {
  if (status === 'DONE') return 'done'
  const due = dayKey(dueDate)
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  if (due <= addDays(today, 7)) return 'soon'
  return 'later'
}
