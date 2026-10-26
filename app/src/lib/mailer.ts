import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// Lazy init: transporter chỉ tạo khi gọi hàm, không phải lúc module load
// → tránh fail khi SMTP_* chưa có lúc build, và dễ mock trong test
let _transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (_transporter) return _transporter

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP chưa được cấu hình. Cần đặt SMTP_HOST, SMTP_USER, SMTP_PASS trong .env',
    )
  }

  _transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false, // STARTTLS trên port 587
    auth: { user, pass },
  })

  return _transporter
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

interface MagicLinkOptions {
  to: string
  name: string
  magicUrl: string
}

export async function sendMagicLink({ to, name, magicUrl }: MagicLinkOptions) {
  const brandName = process.env.BRAND_NAME ?? 'Việc nội bộ'
  const fromEmail = process.env.SMTP_FROM ?? `no-reply@${process.env.APP_DOMAIN ?? 'localhost'}`

  // Dev mode: in ra console nếu không có SMTP config
  if (!process.env.SMTP_HOST) {
    // Không bao giờ in magic link ra log ở production: ai đọc được log sẽ đăng nhập được
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP chưa được cấu hình (SMTP_HOST)')
    }
    console.log('\n─── MAGIC LINK (dev mode — SMTP chưa cấu hình) ───')
    console.log(`To:  ${to}`)
    console.log(`URL: ${magicUrl}`)
    console.log('───────────────────────────────────────────────────\n')
    return
  }

  const transporter = getTransporter()

  await transporter.sendMail({
    from: `"${brandName}" <${fromEmail}>`,
    to,
    subject: `Đăng nhập vào ${brandName}`,
    text: [
      `Xin chào ${name},`,
      '',
      `Bấm vào liên kết sau để đăng nhập:`,
      magicUrl,
      '',
      'Liên kết hết hạn sau 15 phút và chỉ dùng được một lần.',
      'Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; background: #f8f9fa; padding: 20px; margin: 0;">
  <div style="max-width: 480px; margin: 40px auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">${escapeHtml(brandName)}</h2>
    <p style="color: #555; margin: 0 0 24px;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color: #555; margin: 0 0 24px;">Bấm vào nút bên dưới để đăng nhập:</p>
    <a href="${magicUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Đăng nhập ngay</a>
    <p style="color: #999; font-size: 13px; margin: 24px 0 0;">
      Liên kết hết hạn sau <strong>15 phút</strong> và chỉ dùng được một lần.<br>
      Nếu bạn không yêu cầu, hãy bỏ qua email này.
    </p>
  </div>
</body>
</html>`,
  })
}
