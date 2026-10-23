import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp-relay.brevo.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface MagicLinkOptions {
  to: string
  name: string
  magicUrl: string
}

export async function sendMagicLink({ to, name, magicUrl }: MagicLinkOptions) {
  const brandName = process.env.BRAND_NAME ?? 'Việc nội bộ'
  const fromEmail = process.env.SMTP_FROM ?? `noreply@${process.env.APP_DOMAIN ?? 'localhost'}`

  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
    // Dev mode: in ra console thay vì gửi email
    console.log('\n─── MAGIC LINK (dev mode) ───')
    console.log(`To: ${to}`)
    console.log(`URL: ${magicUrl}`)
    console.log('────────────────────────────\n')
    return
  }

  await transporter.sendMail({
    from: `"${brandName}" <${fromEmail}>`,
    to,
    subject: `Đăng nhập vào ${brandName}`,
    text: `Xin chào ${name},\n\nBấm vào liên kết sau để đăng nhập:\n${magicUrl}\n\nLinh kết hết hạn sau 15 phút và chỉ dùng được một lần.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; background: #f8f9fa; padding: 20px; margin: 0;">
  <div style="max-width: 480px; margin: 40px auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">${brandName}</h2>
    <p style="color: #555; margin: 0 0 24px;">Xin chào <strong>${name}</strong>,</p>
    <p style="color: #555; margin: 0 0 24px;">Bấm vào nút bên dưới để đăng nhập:</p>
    <a href="${magicUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Đăng nhập ngay</a>
    <p style="color: #999; font-size: 13px; margin: 24px 0 0;">Liên kết hết hạn sau <strong>15 phút</strong> và chỉ dùng được một lần.<br>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
  </div>
</body>
</html>`,
  })
}
