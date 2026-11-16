import React from 'react'

import {
  SCHOOL_ADDRESS,
  SCHOOL_FULL_NAME,
  SCHOOL_PHONE,
  SCHOOL_PRIVACY_URL,
  SCHOOL_WEBSITE,
} from '@/lib/school'

const linkClass =
  'rounded-sm text-brand-gold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold'

export function Footer() {
  return (
    <footer className="mt-8 border-t-2 border-brand-gold bg-brand-red-dark text-gold-soft">
      <div className="mx-auto max-w-[1080px] px-4 pt-5 pb-6 text-center text-sm">
        <div>
          {SCHOOL_ADDRESS}{' '}
          <span className="whitespace-nowrap">
            · โทร{' '}
            <a className={linkClass} href={`tel:${SCHOOL_PHONE.replace(/\D/g, '')}`}>
              {SCHOOL_PHONE}
            </a>
          </span>
        </div>
        <div className="my-1.5 font-semibold text-on-dark">{SCHOOL_FULL_NAME}</div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <a className={linkClass} href={SCHOOL_WEBSITE} rel="noopener noreferrer" target="_blank">
            {new URL(SCHOOL_WEBSITE).host}
          </a>
          {SCHOOL_PRIVACY_URL ? (
            <a className={linkClass} href={SCHOOL_PRIVACY_URL} rel="noopener noreferrer" target="_blank">
              นโยบายความเป็นส่วนตัว
            </a>
          ) : null}
        </div>
        <div className="mt-2.5 text-brand-gold">พัฒนาโดย กลุ่มคอมพิวเตอร์</div>
      </div>
    </footer>
  )
}
