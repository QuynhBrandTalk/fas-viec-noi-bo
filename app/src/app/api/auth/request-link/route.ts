import { NextRequest, NextResponse } from 'next/server'
import { requestMagicLink } from '@/lib/auth'
import { z } from 'zod'
import { guardMutation } from '@/lib/api'

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
})

export async function POST(req: NextRequest) {
  const blocked = guardMutation(req)
  if (blocked) return blocked
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0'
    const result = await requestMagicLink(parsed.data.email, ip)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 429 })
    }

    // Luôn trả 200 để không tiết lộ email có tồn tại hay không
    return NextResponse.json({
      message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được liên kết đăng nhập.',
    })
  } catch (error) {
    console.error('[request-link]', error)
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 })
  }
}
