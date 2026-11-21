/**
 * Password reset by email is not offered: the app has no email adapter. Shown by the
 * replaced POST /api/users/forgot-password and by the /admin/forgot view.
 * Pure (no Payload/React import), so both server config and views can use it.
 */
export const PASSWORD_RESET_HELP = 'ระบบนี้ไม่มีการรีเซ็ตรหัสผ่านทางอีเมล — กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งรหัสผ่านใหม่'
