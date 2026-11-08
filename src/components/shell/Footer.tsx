import React from 'react'

import { SCHOOL_FULL_NAME } from '@/lib/school'

export function Footer() {
  return (
    <footer className="mt-8 border-t-2 border-brand-gold bg-brand-red-dark text-gold-soft">
      <div className="mx-auto max-w-[1080px] px-4 pt-5 pb-6 text-center text-sm">
        <div>108 ม.9 ถ.มลิวัลย์ ต.โนนสะอาด อ.ชุมแพ จ.ขอนแก่น</div>
        <div className="my-1.5 font-semibold text-on-dark">{SCHOOL_FULL_NAME}</div>
        <div className="mt-2.5 text-brand-gold">พัฒนาโดย กลุ่มคอมพิวเตอร์</div>
      </div>
    </footer>
  )
}
