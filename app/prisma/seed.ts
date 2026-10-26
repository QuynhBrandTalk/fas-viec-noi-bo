import { PrismaClient } from '@prisma/client'

/**
 * Dữ liệu khởi tạo: các bộ phận và một tài khoản ADMIN đầu tiên.
 * Chạy lại nhiều lần vẫn an toàn (upsert).
 *
 *   SEED_ADMIN_EMAIL="ceo@congty.vn" SEED_ADMIN_NAME="CEO" npm run db:seed
 */
const prisma = new PrismaClient()

const DEPARTMENTS = ['Ban Giám đốc', 'Kinh doanh', 'Marketing', 'Vận hành', 'Kỹ thuật', 'Pháp lý']

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase()
  if (!adminEmail) throw new Error('Thiếu SEED_ADMIN_EMAIL')
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || 'Quản trị viên'

  const departments = []
  for (const name of DEPARTMENTS) {
    departments.push(await prisma.department.upsert({ where: { name }, update: {}, create: { name } }))
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', active: true },
    create: { email: adminEmail, fullName: adminName, role: 'ADMIN', departmentId: departments[0].id },
  })

  console.log(`Seed xong: ${departments.length} bộ phận, admin ${admin.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
