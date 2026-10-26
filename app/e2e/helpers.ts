import { expect, type APIRequestContext, type Page } from '@playwright/test'

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025'

/** Chờ email magic link mới nhất gửi tới `email` trong Mailpit, trả về URL. */
export async function latestMagicLink(request: APIRequestContext, email: string, after: number): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    const body = await res.json()
    const msg = (body.messages ?? []).find((m: { Created: string }) => Date.parse(m.Created) >= after)
    if (msg) {
      const full = await (await request.get(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()
      const match = String(full.Text).match(/https?:\/\/\S+\/auth\/verify\?token=[a-f0-9]{64}/)
      if (match) return match[0]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Không thấy email đăng nhập gửi tới ${email}`)
}

/** Đăng nhập trọn luồng: nhập email → nhận mail → bấm link → bấm "Đăng nhập". */
export async function login(page: Page, email: string): Promise<string> {
  const startedAt = Date.now() - 1000
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click()
  await expect(page.getByText('Kiểm tra hộp thư của bạn')).toBeVisible()

  const link = await latestMagicLink(page.request, email, startedAt)
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
