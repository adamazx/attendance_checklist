/**
 * The school's display name and affiliation — the single source for every page,
 * metadata and report export. Pure (no React), so the node test runner can load it.
 */
export const SCHOOL_NAME = 'โรงเรียนมัธยมหนองเขียด'
export const SCHOOL_AFFILIATION = 'องค์การบริหารส่วนจังหวัดขอนแก่น'

/** `โรงเรียน… องค์การบริหารส่วนจังหวัดขอนแก่น` — the name line used in headers and footers. */
export const SCHOOL_FULL_NAME = `${SCHOOL_NAME} ${SCHOOL_AFFILIATION}`

/** Postal address shown in the site footer. */
export const SCHOOL_ADDRESS = 'บ้านหนองเขียด ต.หนองเขียด อ.ชุมแพ จ.ขอนแก่น 40290'

/** Main office phone, display format. Derive `tel:` hrefs by stripping non-digits. */
export const SCHOOL_PHONE = '088-564-5070'

/** The school's public website. */
export const SCHOOL_WEBSITE = 'https://www.mtyk.ac.th'

/**
 * The school's privacy-policy page. `null` until the school supplies the URL —
 * the footer omits the link entirely while this is unset.
 */
export const SCHOOL_PRIVACY_URL: string | null = null
