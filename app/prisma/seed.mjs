// Dữ liệu khởi tạo: các bộ phận và tài khoản ADMIN đầu tiên.
// JavaScript thuần để chạy được ngay trong image production (không cần tsx/devDependencies).
// Chạy lại nhiều lần vẫn an toàn (upsert).
//
//   Máy dev / CI:   SEED_ADMIN_EMAIL=ceo@congty.vn npm run db:seed
//   Trên VPS:       docker compose exec -e SEED_ADMIN_EMAIL=ceo@congty.vn web node prisma/seed.mjs
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEPARTMENTS = ['Ban Giám đốc', 'Kinh doanh', 'Marketing', 'Vận hành', 'Kỹ thuật', 'Pháp lý']

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    throw new Error('Thiếu hoặc sai SEED_ADMIN_EMAIL')
  }
  const adminName = (process.env.SEED_ADMIN_NAME ?? '').trim() || 'Quản trị viên'

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
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
