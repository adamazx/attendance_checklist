# Deployment (การติดตั้งและปรับใช้)

> การตั้งค่า Vercel + Neon, ตัวแปรสภาพแวดล้อม (env vars) และการกำหนดค่าปีการศึกษา

## Hosting

- **Vercel** — โฮสต์ Next.js + Payload 3 ร่วมกันในแอปเดียว
- **Neon** — Postgres database (serverless)

## Setup steps (ขั้นตอนการตั้งค่า)

1. สร้างโปรเจกต์ Neon และดึง connection string
2. ตั้งค่าโปรเจกต์ Vercel เชื่อมกับ repository
3. กำหนด environment variables (ด้านล่าง)
4. Deploy; รัน migration ของ Payload Postgres adapter
5. สร้างบัญชี Admin แรกและกำหนดปีการศึกษาที่ใช้งาน (active academic year)

## Environment variables (ตัวแปรสภาพแวดล้อม)

| Variable | หน้าที่ |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `PAYLOAD_SECRET` | คีย์ลับสำหรับ Payload auth/encryption |
| `NEXT_PUBLIC_SERVER_URL` | URL ของแอปที่ deploy |
| *(เพิ่มเติมตามต้องการ)* | เช่น SMTP, LINE OA token (Phase 2) |

> ค่าจริงของ env vars เป็น stub — กำหนดตอนตั้งค่า Vercel/Neon

## Academic-year config (การกำหนดค่าปีการศึกษา)

- กำหนดปีการศึกษาและภาคเรียนที่ใช้งานอยู่ (`isActive`) ผ่าน Payload admin
- date picker ในระบบจะอิงภาคเรียนที่ใช้งานอยู่เป็นค่าเริ่มต้น
- เมื่อขึ้นปีการศึกษาใหม่ ให้สร้าง AcademicYear + Term ใหม่และตั้ง `isActive`

## Related

- Tech stack: [../03-architecture/tech-stack.md](../03-architecture/tech-stack.md)
- Build phases: [../07-roadmap/phases.md](../07-roadmap/phases.md)
