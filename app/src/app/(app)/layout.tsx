import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/rbac'
import { logout } from '@/app/actions/auth'

// Mọi trang trong ứng dụng đọc phiên và database theo từng yêu cầu
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/dang-nhap')

  const brandName = process.env.BRAND_NAME ?? 'Việc nội bộ'

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 min-h-14">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-semibold text-gray-900 text-sm">{brandName}</span>
              <div className="flex flex-wrap items-center gap-1">
                <NavLink href="/hom-nay">Hôm nay</NavLink>
                <NavLink href="/bang-viec">Bảng việc</NavLink>
                <NavLink href="/du-an">Dự án</NavLink>
                <NavLink href="/bao-cao">Báo cáo</NavLink>
                {user.role === 'ADMIN' && <NavLink href="/admin/nguoi-dung">Người dùng</NavLink>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500" data-testid="current-user">
                {user.name} · {ROLE_LABELS[user.role]}
              </span>
              <form action={logout}>
                <button type="submit" className="text-xs text-gray-600 hover:text-gray-900 underline">
                  Đăng xuất
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md">
      {children}
    </Link>
  )
}
