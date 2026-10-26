/**
 * Địa chỉ công khai của app, lấy từ AUTH_URL (hoặc NEXTAUTH_URL cho tương thích).
 * Bắt buộc https://, trừ localhost (máy dev và CI).
 * Dùng cho link trong email và kiểm tra Origin chống CSRF.
 */
export function appBaseUrl(): string {
  const raw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  if (!raw) throw new Error('Thiếu AUTH_URL (vd. https://viec.ten-mien.vn)')

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`AUTH_URL không hợp lệ: ${raw}`)
  }
  const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !isLocal) {
    throw new Error('AUTH_URL phải bắt đầu bằng https://')
  }
  return url.origin
}

export function appOrigin(): string {
  return appBaseUrl()
}
