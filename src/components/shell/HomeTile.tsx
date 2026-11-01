import Link from 'next/link'
import React from 'react'

import { LogoutButton } from './LogoutButton'

export type TileTone = 'amber' | 'blue' | 'green' | 'danger'

const toneClass: Record<TileTone, string> = {
  amber: 'bg-action-amber text-on-amber',
  blue: 'bg-action-blue text-on-dark',
  green: 'bg-action-green text-on-dark',
  danger: 'bg-action-danger text-on-dark',
}

const base =
  'flex min-h-26 w-full flex-col items-center justify-center gap-2 rounded-xl border-t-3 border-brand-gold px-3.5 py-4 text-center font-semibold no-underline shadow-card'
const live = 'cursor-pointer transition hover:-translate-y-0.5 hover:brightness-105'

const Face = (props: { hint?: string; icon: string; label: string }) => (
  <>
    <span aria-hidden="true" className="text-3xl leading-none">
      {props.icon}
    </span>
    <span>{props.label}</span>
    {props.hint && <span className="text-xs font-normal">{props.hint}</span>}
  </>
)

export type HomeTileProps = {
  icon: string
  label: string
  tone: TileTone
} & ({ href: string } | { logout: true } | { comingSoon: true })

export function HomeTile(props: HomeTileProps) {
  const { icon, label, tone } = props
  if ('href' in props) {
    return (
      <Link className={`${base} ${live} ${toneClass[tone]}`} href={props.href}>
        <Face icon={icon} label={label} />
      </Link>
    )
  }
  if ('logout' in props) {
    return (
      <LogoutButton className={`${base} ${live} ${toneClass[tone]}`}>
        <Face icon={icon} label={label} />
      </LogoutButton>
    )
  }
  return (
    <button className={`${base} cursor-not-allowed bg-line text-muted`} disabled type="button">
      <Face hint="เร็ว ๆ นี้" icon={icon} label={label} />
    </button>
  )
}
