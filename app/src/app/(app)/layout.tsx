import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Role } from '@prisma/client'
import { ROLE_LABELS } from '@/lib/rbac'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/dang-nhap')

  const role = session.user.role as Role
  const brandName = process.env.BRAND_NAME ?? 'Việc nội bộ'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <span className="font-semibold text-gray-900 text-sm">{brandName}</span>
              <div className="hidden sm:flex items-center gap-1">
                <NavLink href="/hom-nay">Hôm nay</NavLink>
                <NavLink href="/bang-viec">Bảng việc</NavLink>
                <NavLink href="/du-an">Dự án</NavLink>
                {(role === 'ADMIN' || role === 'MANAGER') && (
                  <NavLink href="/bao-cao">Báo cáo</NavLink>
                )}
                {role === 'ADMIN' && (
                  <NavLink href="/admin/nguoi-dung">Người dùng</NavLink>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 hidden sm:block">
                {session.user.name} · {ROLE_LABELS[role]}
              </span>
              <form action="/api/auth/signout" method="POST">
                <button type="submit" className="text-xs text-gray-500 hover:text-gray-700">
                  Đăng xuất
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
    >
      {children}
    </Link>
  )
}
