'use client'

import React from 'react'

export function PrintButton() {
  return (
    <button
      className="min-h-11 cursor-pointer rounded-lg border border-brand-gold bg-brand-red px-5 font-semibold text-on-dark hover:bg-brand-red-dark print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      🖨️ พิมพ์
    </button>
  )
}
