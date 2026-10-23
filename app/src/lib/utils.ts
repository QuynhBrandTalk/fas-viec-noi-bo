import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format ngày dd/mm/yyyy theo múi giờ Việt Nam
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

// Format tiền VNĐ
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

// Kiểm tra việc quá hạn (theo múi giờ HCM)
export function isOverdue(dueDate: Date | string, status: string): boolean {
  if (status === 'DONE') return false
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  const now = new Date(new Date().toLocaleString('en', { timeZone: 'Asia/Ho_Chi_Minh' }))
  return due < now
}

// Chỉ cho phép https://
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}
