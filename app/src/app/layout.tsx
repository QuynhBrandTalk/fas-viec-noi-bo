import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: process.env.BRAND_NAME ?? 'Việc nội bộ',
  description: 'Hệ thống quản trị công việc nội bộ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
