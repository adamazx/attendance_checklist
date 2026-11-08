/**
 * The school's display name and affiliation — the single source for every page,
 * metadata and report export. Pure (no React), so the node test runner can load it.
 */
export const SCHOOL_NAME = 'โรงเรียนมัธยมหนองเขียด'
export const SCHOOL_AFFILIATION = 'องค์การบริหารส่วนจังหวัดขอนแก่น'

/** `โรงเรียน… องค์การบริหารส่วนจังหวัดขอนแก่น` — the name line used in headers and footers. */
export const SCHOOL_FULL_NAME = `${SCHOOL_NAME} ${SCHOOL_AFFILIATION}`
