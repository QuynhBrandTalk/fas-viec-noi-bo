/**
 * Nonce ngắn hạn để ràng buộc /api/auth/verify với /auth/callback
 *
 * Vấn đề: /auth/callback nhận uid từ URL public → ai cũng có thể forge
 * uid để đăng nhập thành user khác (session hijack).
 *
 * Giải pháp: Sau khi verifyMagicToken() thành công, route handler set một
 * HttpOnly signed cookie chứa {userId, exp}. Callback page đọc và verify
 * cookie trước khi gọi signIn(). Cookie chỉ sống 60 giây và 1 lần dùng.
 *
 * Ký bằng HMAC-SHA256 với NEXTAUTH_SECRET → không thể forge từ client.
 */

import crypto from 'crypto'

const NONCE_TTL_SECONDS = 60

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET chưa được đặt')
  return secret
}

interface NoncePayload {
  userId: string
  exp: number // unix timestamp
}

/** Tạo nonce string: base64(JSON) + "." + HMAC signature */
export function createNonce(userId: string): string {
  const payload: NoncePayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + NONCE_TTL_SECONDS,
  }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('base64url')
  return `${data}.${sig}`
}

/** Verify nonce — trả về userId hoặc null nếu không hợp lệ/hết hạn */
export function verifyNonce(nonce: string): string | null {
  try {
    const [data, sig] = nonce.split('.')
    if (!data || !sig) return null

    // Kiểm tra chữ ký
    const expectedSig = crypto
      .createHmac('sha256', getSecret())
      .update(data)
      .digest('base64url')

    // So sánh constant-time để tránh timing attack
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null
    }

    // Kiểm tra expiry
    const payload: NoncePayload = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (Math.floor(Date.now() / 1000) > payload.exp) return null

    return payload.userId
  } catch {
    return null
  }
}

export const NONCE_COOKIE_NAME = '__auth_nonce'
export const NONCE_TTL_SECONDS_EXPORT = NONCE_TTL_SECONDS
