import { expect, type APIRequestContext, type Page } from '@playwright/test'

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025'

type MailSummary = { ID: string }

async function messageIds(request: APIRequestContext, email: string): Promise<Set<string>> {
  const res = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
  const body = await res.json()
  return new Set((body.messages ?? []).map((m: MailSummary) => m.ID))
}

/** Chờ email magic link MỚI (ID chưa có trong `seen`) gửi tới `email`, trả về URL. */
export async function newMagicLink(request: APIRequestContext, email: string, seen: Set<string>): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    const body = await res.json()
    const msg = (body.messages ?? []).find((m: MailSummary) => !seen.has(m.ID))
    if (msg) {
      const full = await (await request.get(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()
      const match = String(full.Text).match(/https?:\/\/\S+\/auth\/verify\?token=[a-f0-9]{64}/)
      if (match) return match[0]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Không thấy email đăng nhập mới gửi tới ${email}`)
}

/** Gửi yêu cầu đăng nhập cho `email` và trả về tập email đã có trước đó. */
export async function requestLink(page: Page, email: string): Promise<Set<string>> {
  const seen = await messageIds(page.request, email)
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click()
  await expect(page.getByText('Kiểm tra hộp thư của bạn')).toBeVisible()
  return seen
}

/** Đăng nhập trọn luồng: nhập email → nhận mail → bấm link → bấm "Đăng nhập". */
export async function login(page: Page, email: string): Promise<string> {
  const seen = await requestLink(page, email)
  const link = await newMagicLink(page.request, email, seen)
  await page.goto(link)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/hom-nay/)
  return link
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(page).toHaveURL(/\/dang-nhap/)
}

/** Ngày theo giờ Việt Nam (khớp cách app tính "hôm nay"), cộng thêm offsetDays. */
export function isoDate(offsetDays: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  const d = new Date(`${today}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
