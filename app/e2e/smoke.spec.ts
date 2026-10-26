import { expect, test } from '@playwright/test'
import { isoDate, latestMagicLink, login, logout } from './helpers'

/**
 * Bộ kiểm thử khói G1 — chạy tuần tự, mỗi bước dựa trên bước trước.
 * Dữ liệu là dữ liệu giả (không dùng dữ liệu thật — theo quy tắc pháp lý).
 */

const ADMIN = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.test'
const RUN = Date.now().toString(36)
const MANAGER = `quanly-${RUN}@example.test`
const MEMBER = `nhanvien-${RUN}@example.test`
const OTHER = `khac-${RUN}@example.test`
const PROJECT = `Dự án thử ${RUN}`
const TASK = `Việc thử ${RUN}`

test.describe.configure({ mode: 'serial' })

test('S1. Healthcheck trả 200', async ({ request }) => {
  const res = await request.get('/api/healthz')
  expect(res.status()).toBe(200)
})

test('S2. Chưa đăng nhập bị chuyển về /dang-nhap', async ({ page }) => {
  await page.goto('/hom-nay')
  await expect(page).toHaveURL(/\/dang-nhap/)
})

test('S3. API từ chối khi chưa đăng nhập', async ({ request }) => {
  expect((await request.get('/api/tasks')).status()).toBe(401)
  expect((await request.post('/api/projects', { data: {} })).status()).toBe(401)
})

test('S4. Email chưa được mời nhận cùng phản hồi, không có thư', async ({ page }) => {
  const startedAt = Date.now() - 1000
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill('khongtontai@example.test')
  await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click()
  await expect(page.getByText('Kiểm tra hộp thư của bạn')).toBeVisible()
  await expect(latestMagicLink(page.request, 'khongtontai@example.test', startedAt)).rejects.toThrow()
})

test('S5. Admin đăng nhập, mời Quản lý và Thành viên', async ({ page }) => {
  await login(page, ADMIN)
  await page.goto('/admin/nguoi-dung')

  for (const [email, name, role] of [
    [MANAGER, 'Quản lý Thử', 'MANAGER'],
    [MEMBER, 'Nhân viên Thử', 'MEMBER'],
    [OTHER, 'Người Khác', 'MEMBER'],
  ] as const) {
    await page.getByRole('button', { name: '+ Mời người dùng' }).click()
    await page.getByLabel('Họ tên *').fill(name)
    await page.getByLabel('Email *').fill(email)
    await page.getByLabel('Vai trò *').selectOption(role)
    await page.getByLabel('Bộ phận').selectOption({ label: 'Marketing' })
    await page.getByRole('button', { name: 'Thêm người dùng' }).click()
    await expect(page.getByRole('cell', { name: email })).toBeVisible()
  }
  await logout(page)
})

test('S6. Token dùng lần hai bị từ chối', async ({ page, browser }) => {
  const link = await login(page, MANAGER)
  await logout(page)

  const fresh = await browser.newPage()
  await fresh.goto(link)
  await fresh.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(fresh).toHaveURL(/\/dang-nhap/)
  await expect(fresh.getByText(/không hợp lệ/)).toBeVisible()
  await fresh.close()
})

test('S7. Token giả không đăng nhập được', async ({ page }) => {
  await page.goto(`/auth/verify?token=${'a'.repeat(64)}`)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/dang-nhap/)
})

test('S8. Quản lý tạo dự án và giao việc cho Thành viên', async ({ page }) => {
  await login(page, MANAGER)

  await page.goto('/du-an/tao-moi')
  await page.getByLabel('Tên dự án').fill(PROJECT)
  await page.getByLabel('Ngày bắt đầu').fill(isoDate(0))
  await page.getByLabel('Ngày kết thúc').fill(isoDate(30))
  await page.getByRole('button', { name: 'Tạo dự án' }).click()
  await expect(page.getByRole('heading', { name: PROJECT })).toBeVisible()

  await page.getByRole('link', { name: '+ Tạo việc' }).click()
  await page.getByLabel('Tên việc').fill(TASK)
  await page.getByLabel('Người phụ trách').selectOption({ label: 'Nhân viên Thử' })
  await page.getByLabel('Bắt đầu').fill(isoDate(0))
  await page.getByLabel('Hạn hoàn thành').fill(isoDate(0))
  await page.getByRole('button', { name: 'Tạo việc' }).click()
  await expect(page.getByRole('cell', { name: TASK })).toBeVisible()

  // Việc không có người phụ trách: hiện cảnh báo đỏ (đặc tả M3)
  await page.getByRole('link', { name: '+ Tạo việc' }).click()
  await page.getByLabel('Tên việc').fill(`${TASK} chưa giao`)
  await page.getByRole('button', { name: 'Tạo việc' }).click()
  await expect(page.getByText('Chưa có người phụ trách')).toBeVisible()
  await logout(page)
})

test('S9. Kiểm tra dữ liệu đầu vào: hạn trước ngày bắt đầu và link không phải https', async ({ page }) => {
  await login(page, MANAGER)
  const projects = await (await page.request.get('/api/projects')).json()
  const project = projects.data.find((p: { name: string }) => p.name === PROJECT)
  expect(project).toBeTruthy()

  const bad = await page.request.post('/api/tasks', {
    data: { projectId: project.id, title: 'Sai ngày', startDate: isoDate(5), dueDate: isoDate(1) },
  })
  expect(bad.status()).toBe(400)

  const tasks = await (await page.request.get(`/api/tasks?projectId=${project.id}`)).json()
  const task = tasks.data.find((t: { title: string }) => t.title === TASK)
  for (const url of ['http://example.com', 'javascript:alert(1)']) {
    const res = await page.request.post(`/api/tasks/${task.id}/links`, { data: { title: 'x', url } })
    expect(res.status()).toBe(400)
  }
  const ok = await page.request.post(`/api/tasks/${task.id}/links`, { data: { title: 'Tài liệu', url: 'https://example.com/doc' } })
  expect(ok.status()).toBe(201)

  // Ngày không tồn tại bị từ chối (không tự lùi sang tháng sau)
  const badDate = await page.request.post('/api/tasks', {
    data: { projectId: project.id, title: 'Ngày ảo', startDate: '2026-02-31', dueDate: '2026-03-05' },
  })
  expect(badDate.status()).toBe(400)

  // Chống CSRF: body dạng text/plain (form HTML) và Origin lạ đều bị chặn
  const plain = await page.request.post('/api/tasks', {
    headers: { 'Content-Type': 'text/plain' },
    data: JSON.stringify({ projectId: project.id, title: 'csrf', startDate: isoDate(0), dueDate: isoDate(0) }),
  })
  expect(plain.status()).toBe(415)
  const foreign = await page.request.patch(`/api/tasks/${task.id}`, {
    headers: { Origin: 'https://evil.example' },
    data: { status: 'DONE' },
  })
  expect(foreign.status()).toBe(403)
  await logout(page)
})

test('S10. Thành viên thấy việc ở Hôm nay và đổi trạng thái', async ({ page }) => {
  await login(page, MEMBER)
  await expect(page.getByText(TASK, { exact: true })).toBeVisible()

  const select = page.getByLabel(`Trạng thái: ${TASK}`, { exact: true })
  await select.selectOption('DOING')
  await page.reload()
  await expect(page.getByLabel(`Trạng thái: ${TASK}`, { exact: true })).toHaveValue('DOING')
  await logout(page)
})

test('S11. Phân quyền: Thành viên không tạo/xoá được, người khác không sửa được việc không phải của mình', async ({ page }) => {
  await login(page, MEMBER)
  const projects = await (await page.request.get('/api/projects')).json()
  const project = projects.data.find((p: { name: string }) => p.name === PROJECT)
  const tasks = await (await page.request.get(`/api/tasks?projectId=${project.id}`)).json()
  const task = tasks.data.find((t: { title: string }) => t.title === TASK)

  expect((await page.request.post('/api/projects', {
    data: { name: 'x', departmentId: project.departmentId, startDate: isoDate(0), endDate: isoDate(1) },
  })).status()).toBe(403)
  expect((await page.request.delete(`/api/tasks/${task.id}`)).status()).toBe(403)
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { ownerId: null } })).status()).toBe(403)
  await logout(page)

  await login(page, OTHER)
  expect((await page.request.patch(`/api/tasks/${task.id}`, { data: { status: 'DONE' } })).status()).toBe(403)
  // ...nhưng vẫn xem được (theo kiến trúc: mọi người xem tất cả việc)
  expect((await page.request.get(`/api/tasks/${task.id}`)).status()).toBe(200)
  await logout(page)

  // Quản lý cũng không xoá được (chỉ Admin)
  await login(page, MANAGER)
  expect((await page.request.delete(`/api/tasks/${task.id}`)).status()).toBe(403)
  await logout(page)
})

test('S12b. Trang đăng nhập không hiển thị nội dung tuỳ ý từ URL', async ({ page }) => {
  await page.goto('/dang-nhap?error=' + encodeURIComponent('Hãy gọi 0900 000 000 để nhận thưởng'))
  await expect(page.getByText('Hãy gọi 0900')).toHaveCount(0)
  await expect(page.getByText('Đăng nhập không thành công')).toBeVisible()
})

test('S12. Admin xem Bảng việc toàn công ty', async ({ page }) => {
  await login(page, ADMIN)
  await expect(page.getByTestId('current-user')).toContainText('Quản trị viên')
  await page.goto('/bang-viec')
  await expect(page.getByRole('heading', { name: 'Bảng việc' })).toBeVisible()
  await expect(page.getByText(TASK, { exact: true })).toBeVisible()
  await logout(page)
})
