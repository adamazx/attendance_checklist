/**
 * Select options for the student master record. Values are ASCII (Postgres enum
 * values and future GraphQL enum names); labels are Thai. Every open set ends in
 * `other`, so an unexpected source value is stored as `other` instead of failing.
 */
export const genderOptions = [
  { label: 'ชาย', value: 'male' },
  { label: 'หญิง', value: 'female' },
]

export const programOptions = [
  { label: 'ทั่วไป', value: 'general' },
  { label: 'วิทย์-คณิต', value: 'sci_math' },
  { label: 'ศิลป์-คำนวณ', value: 'arts_math' },
  { label: 'ศิลป์-ภาษา', value: 'arts_lang' },
  { label: 'อื่น ๆ', value: 'other' },
]

/** Shared by nationality (สัญชาติ) and ethnicity (เชื้อชาติ). */
export const nationOptions = [
  { label: 'ไทย', value: 'thai' },
  { label: 'ลาว', value: 'lao' },
  { label: 'เมียนมา', value: 'myanmar' },
  { label: 'กัมพูชา', value: 'cambodian' },
  { label: 'เวียดนาม', value: 'vietnamese' },
  { label: 'จีน', value: 'chinese' },
  { label: 'อื่น ๆ', value: 'other' },
]

export const religionOptions = [
  { label: 'พุทธ', value: 'buddhism' },
  { label: 'อิสลาม', value: 'islam' },
  { label: 'คริสต์', value: 'christianity' },
  { label: 'ฮินดู', value: 'hinduism' },
  { label: 'ซิกข์', value: 'sikhism' },
  { label: 'ไม่นับถือศาสนา', value: 'none' },
  { label: 'อื่น ๆ', value: 'other' },
]

export const maritalStatusOptions = [
  { label: 'สมรส/อยู่ด้วยกัน', value: 'married' },
  { label: 'หย่าร้าง', value: 'divorced' },
  { label: 'แยกกันอยู่', value: 'separated' },
  { label: 'หม้าย', value: 'widowed' },
  { label: 'โสด', value: 'single' },
  { label: 'เสียชีวิต', value: 'deceased' },
  { label: 'อื่น ๆ', value: 'other' },
]

export const studentConditionOptions = [
  { label: 'ปกติ', value: 'normal' },
  { label: 'ยากจน', value: 'poor' },
  { label: 'ด้อยโอกาส', value: 'disadvantaged' },
  { label: 'อื่น ๆ', value: 'other' },
]

/** The nine DLA disability types. */
export const disabilityOptions = [
  { label: 'บกพร่องทางการมองเห็น', value: 'visual' },
  { label: 'บกพร่องทางการได้ยิน', value: 'hearing' },
  { label: 'บกพร่องทางสติปัญญา', value: 'intellectual' },
  { label: 'บกพร่องทางร่างกายหรือสุขภาพ', value: 'physical_health' },
  { label: 'บกพร่องทางการเรียนรู้', value: 'learning' },
  { label: 'บกพร่องทางการพูดและภาษา', value: 'speech_language' },
  { label: 'บกพร่องทางพฤติกรรมหรืออารมณ์', value: 'behavioral_emotional' },
  { label: 'ออทิสติก', value: 'autism' },
  { label: 'พิการซ้อน', value: 'multiple' },
]

export const scoutTypeOptions = [
  { label: 'ลูกเสือ', value: 'scout' },
  { label: 'เนตรนารี', value: 'girl_guide' },
  { label: 'ยุวกาชาด', value: 'red_cross_youth' },
]

/** Thai label for a stored option value (falls back to the value). */
export const optionLabel = (options: ReadonlyArray<{ label: string; value: string }>, value: unknown): string =>
  options.find((o) => o.value === value)?.label ?? (value == null ? '' : String(value))
