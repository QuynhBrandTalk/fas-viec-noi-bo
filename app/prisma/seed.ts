import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Tạo bộ phận mẫu cho FAS
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: 'Ban Giám đốc' },
      update: {},
      create: { name: 'Ban Giám đốc' },
    }),
    prisma.department.upsert({
      where: { name: 'Marketing' },
      update: {},
      create: { name: 'Marketing' },
    }),
    prisma.department.upsert({
      where: { name: 'Sale' },
      update: {},
      create: { name: 'Sale' },
    }),
    prisma.department.upsert({
      where: { name: 'Vận hành' },
      update: {},
      create: { name: 'Vận hành' },
    }),
    prisma.department.upsert({
      where: { name: 'Kỹ thuật' },
      update: {},
      create: { name: 'Kỹ thuật' },
    }),
  ])

  console.log(`✅ ${departments.length} bộ phận`)

  // Tạo tài khoản admin (CEO)
  const admin = await prisma.user.upsert({
    where: { email: 'ceo@brandtalk.asia' },
    update: {},
    create: {
      email: 'ceo@brandtalk.asia',
      fullName: 'CEO FAS',
      role: 'ADMIN',
      departmentId: departments[0].id,
    },
  })

  console.log(`✅ Admin: ${admin.email}`)
  console.log('\n🎉 Seed hoàn tất!')
  console.log('\nĐể đăng nhập, vào trang /dang-nhap và nhập email: ceo@brandtalk.asia')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
