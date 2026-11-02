import React from 'react'

import { HomeTile, type HomeTileProps } from '@/components/shell/HomeTile'
import { requireUser } from '@/lib/auth/currentUser'
import { formatThaiDateTime } from '@/lib/date/thaiDay'

const advisorTiles: HomeTileProps[] = [
  { href: '/attendance', icon: '📌', label: 'เช็คชื่อ', tone: 'amber' },
  { comingSoon: true, icon: '📄', label: 'รายงานรายห้อง', tone: 'blue' },
  { comingSoon: true, icon: '📊', label: 'สถิตินักเรียน', tone: 'blue' },
  { comingSoon: true, icon: '📈', label: 'กราฟ', tone: 'blue' },
  { href: '/attendance/edit', icon: '✏️', label: 'แก้ไขเช็คชื่อ', tone: 'green' },
  { href: '/attendance/backdate', icon: '📝', label: 'เช็คชื่อย้อนหลัง', tone: 'blue' },
  { comingSoon: true, icon: '⏰', label: 'นักเรียนมาสาย', tone: 'green' },
  { comingSoon: true, icon: '🧾', label: 'รายงานนักเรียน', tone: 'blue' },
]

// Admin and discipline work in /admin for now (Phase 2b is the advisor UI).
const staffTiles: HomeTileProps[] = [{ href: '/admin', icon: '🛠️', label: 'ระบบผู้ดูแล', tone: 'blue' }]

const accountTiles: HomeTileProps[] = [
  { href: '/change-password', icon: '🔑', label: 'เปลี่ยนรหัสผ่าน', tone: 'green' },
  { icon: '🚪', label: 'Logout', logout: true, tone: 'danger' },
]

export default async function HomePage() {
  const user = await requireUser()
  const tiles = [...(user.role === 'advisor' ? advisorTiles : staffTiles), ...accountTiles]

  return (
    <>
      <section className="mt-5 rounded-xl border-t-4 border-brand-gold bg-gradient-to-br from-brand-red to-brand-red-dark px-5 pt-6 pb-11 text-center text-on-dark shadow-card">
        <h1 className="text-2xl font-bold sm:text-3xl">ระบบครูที่ปรึกษา</h1>
        <p className="mx-auto mt-1.5 mb-3.5 max-w-xl text-gold-soft">
          โรงเรียนโนนหันวิทยายน องค์การบริหารส่วนจังหวัดขอนแก่น
        </p>
        <span className="inline-block rounded-full border border-brand-gold bg-brand-gold/20 px-4 py-1.5 text-sm font-medium text-gold-pale">
          วันที่ {formatThaiDateTime(new Date())}
        </span>
      </section>

      <div className="-mt-8 mb-2.5 flex justify-center">
        <div
          aria-label="ตราโรงเรียน"
          className="flex size-21 items-center justify-center rounded-full border-4 border-brand-gold bg-bg-cream text-3xl shadow-card"
          role="img"
        >
          📘
        </div>
      </div>

      <hr className="mt-4.5 mb-5.5 h-px border-0 bg-gradient-to-r from-transparent via-brand-gold to-transparent" />

      <section
        aria-label="เมนูการใช้งาน"
        className="grid grid-cols-1 gap-3.5 pb-2 min-[480px]:grid-cols-2 min-[820px]:grid-cols-4"
      >
        {tiles.map((tile) => (
          <HomeTile key={tile.label} {...tile} />
        ))}
      </section>
    </>
  )
}
