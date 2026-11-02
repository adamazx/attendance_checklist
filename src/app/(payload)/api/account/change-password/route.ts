/**
 * POST /api/account/change-password — self-service password change.
 *
 * The only path for a non-admin to change their password: the Users collection
 * rejects it elsewhere unless this route's verified flag is set. The check goes
 * through `payload.login`, so wrong guesses count toward the account lockout. The
 * update runs with `overrideAccess: false` as the caller, and Payload keeps the
 * caller's session while dropping every other one.
 */
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { AuthenticationError, createLocalReq, getPayload, LockedAuth } from 'payload'

const MIN_LENGTH = 8
const MAX_LENGTH = 128

export async function POST(req: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบก่อน' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as {
    currentPassword?: unknown
    newPassword?: unknown
  } | null
  const currentPassword = body?.currentPassword
  const newPassword = body?.newPassword

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return NextResponse.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 })
  }
  if (currentPassword.trim() === '') {
    return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 })
  }
  // Payload's login rejects a whitespace-only password, so it could never be used.
  if (newPassword.trim().length < MIN_LENGTH || newPassword.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `รหัสผ่านใหม่ต้องมี ${MIN_LENGTH}-${MAX_LENGTH} ตัวอักษร` },
      { status: 400 },
    )
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม' }, { status: 400 })
  }

  try {
    await payload.login({
      collection: 'users',
      data: { email: user.email, password: currentPassword },
    })
  } catch (err) {
    if (err instanceof LockedAuth) {
      return NextResponse.json({ error: 'บัญชีถูกล็อกชั่วคราว กรุณารอ 10 นาที' }, { status: 429 })
    }
    if (err instanceof AuthenticationError) {
      return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 })
    }
    throw err
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { password: newPassword },
    overrideAccess: false,
    req: await createLocalReq({ context: { passwordChangeVerified: true }, user }, payload),
  })

  return NextResponse.json({ ok: true })
}
