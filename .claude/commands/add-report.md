---
description: Scaffold a report page with class/term/date filters + Excel & PDF export
argument-hint: <report-name>
---

Scaffold a new report page $ARGUMENTS under the Next.js app. It must include class, term (ภาคเรียน), and date-range filters; render dates in พ.ศ. with Thai month names; enforce role-scoped data access; and support export to Excel (.xlsx) and PDF with an embedded Thai font and the school header/logo. Reuse shared report/export utilities if they exist (check `lib/` first); otherwise stub them and note it. Match the red–gold theme via the design tokens — do not hardcode colors.
