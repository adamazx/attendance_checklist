# Build Phases (เฟสการพัฒนา)

> เฟสการพัฒนา 0–5 และ Phase 2 เสริม (SDQ, เยี่ยมบ้าน, LINE OA)

## Phases 0–5

### Phase 0 — Setup
Next.js + Payload 3 + Neon บน Vercel; ระบบ auth; roles; base layout (ภาษาไทย)

### Phase 1 — Master data
ปีการศึกษา/ภาคเรียน, ห้องเรียน, นักเรียน, ครู, การมอบหมายครูที่ปรึกษา; นำเข้า CSV

### Phase 2 — Core attendance
เช็คชื่อ (วันนี้), แก้ไข, ย้อนหลัง + AuditLog

### Phase 3 — Reports
รายงานรายห้อง, นักเรียนมาสาย, รายงานนักเรียน + ส่งออก PDF/Excel

### Phase 4 — Stats & graphs
สถิติรายบุคคล, ธงเสี่ยง (at-risk flags), แดชบอร์ดกราฟ

### Phase 5 — Account & polish
เปลี่ยนรหัสผ่าน, Thai locale, print styling, โลโก้, QA

## Optional Phase 2 — Full advisor duties (งานครูที่ปรึกษาเต็มรูปแบบ)

ส่วนขยายในอนาคตครอบคลุมภาระงานครูที่ปรึกษาทั้งหมด:

- การประเมิน **SDQ** (Strengths and Difficulties Questionnaire)
- บันทึกการ **เยี่ยมบ้าน** (home-visit records)
- คะแนนความประพฤติ / คะแนนความดี (behavior/merit scores)
- การแจ้งเตือนผู้ปกครองผ่าน **LINE Official Account** (Messaging API) เมื่อนักเรียนขาดเรียน
- พอร์ทัลสำหรับนักเรียน/ผู้ปกครอง (student/parent portal)

## Related

- สรุปเฟสแบบย่อ: [../01-overview/project-overview.md](../01-overview/project-overview.md)
- การ deploy แต่ละเฟส: [../06-deployment/deployment.md](../06-deployment/deployment.md)
