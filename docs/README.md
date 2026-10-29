# เอกสารระบบครูที่ปรึกษา — Advisor Attendance System Docs

> เอกสารประกอบระบบเช็คชื่อนักเรียนสำหรับครูที่ปรึกษา โรงเรียนโนนหันวิทยายน (อบจ.ขอนแก่น) — Next.js + TypeScript + Payload 3 + Postgres (Neon) + Vercel

## What this system is (ระบบนี้คืออะไร)

ระบบเว็บภาษาไทยสำหรับครูที่ปรึกษา (ครูที่ปรึกษา / homeroom advisors) ใช้เช็คชื่อและจัดการการมาเรียนของนักเรียนรายวัน พร้อมรายงาน สถิติ และกราฟสำหรับครูและผู้บริหาร — ใช้วันที่แบบพุทธศักราช (พ.ศ.) และสอดคล้องกับปฏิทินการศึกษาไทย 2 ภาคเรียน

## How these docs are organized (โครงสร้างเอกสาร)

เอกสารแบ่งตามหัวข้อ เรียงตามลำดับการพัฒนา แต่ละโฟลเดอร์โฟกัสเรื่องเดียว:

### 📁 01-overview
- [project-overview.md](01-overview/project-overview.md) — เป้าหมาย ลูกค้า ขอบเขต และสรุปเฟส

### 📁 02-requirements
- [user-roles.md](02-requirements/user-roles.md) — บทบาทและเมทริกซ์สิทธิ์ (Admin / Advisor / Discipline / Parent)
- [feature-spec.md](02-requirements/feature-spec.md) — การแมปปุ่ม → ฟีเจอร์ จากหน้าแรก

### 📁 03-architecture
- [tech-stack.md](03-architecture/tech-stack.md) — Next.js + TypeScript + Payload 3 + Postgres (Neon) + Vercel
- [data-model.md](03-architecture/data-model.md) — เอนทิตี: AcademicYear, Term, Classroom, Teacher, Student, AttendanceRecord, AuditLog
- [diagrams/](03-architecture/diagrams/) — ERD / flow diagrams

### 📁 04-design
- [design-system.md](04-design/design-system.md) — ธีมแดง–ทอง + ชุดสีปุ่มการกระทำ
- [page-layouts.md](04-design/page-layouts.md) — เค้าโครงหน้าแดชบอร์ด (navbar, hero, logo, grid, footer)
- [assets/](04-design/assets/) — โลโก้, ภาพอ้างอิง, mockup

### 📁 05-reports-exports
- [reports-spec.md](05-reports-exports/reports-spec.md) — ประเภทรายงาน + ส่งออก Excel/PDF (ฟอนต์ไทย, วันที่ พ.ศ.)

### 📁 06-deployment
- [deployment.md](06-deployment/deployment.md) — การตั้งค่า Vercel + Neon, env vars, การกำหนดปีการศึกษา

### 📁 07-roadmap
- [phases.md](07-roadmap/phases.md) — เฟสการพัฒนา 0–5 + Phase 2 เสริม (SDQ, เยี่ยมบ้าน, LINE OA)

### 📁 decisions
- [adr-0001-stack-choice.md](decisions/adr-0001-stack-choice.md) — ADR: เหตุใดจึงเลือก Payload 3 + Postgres แทน Sanity

## Table of contents (สารบัญทั้งหมด)

| ไฟล์ | หัวข้อ |
|------|--------|
| [README.md](README.md) | ดัชนีและภาพรวมเอกสาร |
| [01-overview/project-overview.md](01-overview/project-overview.md) | ภาพรวมโครงการ |
| [02-requirements/user-roles.md](02-requirements/user-roles.md) | บทบาทและสิทธิ์ |
| [02-requirements/feature-spec.md](02-requirements/feature-spec.md) | สเปกฟีเจอร์ |
| [03-architecture/tech-stack.md](03-architecture/tech-stack.md) | เทคโนโลยีและสถาปัตยกรรม |
| [03-architecture/data-model.md](03-architecture/data-model.md) | โครงสร้างข้อมูล |
| [04-design/design-system.md](04-design/design-system.md) | ระบบการออกแบบ |
| [04-design/page-layouts.md](04-design/page-layouts.md) | เค้าโครงหน้า |
| [05-reports-exports/reports-spec.md](05-reports-exports/reports-spec.md) | รายงานและการส่งออก |
| [06-deployment/deployment.md](06-deployment/deployment.md) | การติดตั้งและปรับใช้ |
| [07-roadmap/phases.md](07-roadmap/phases.md) | เฟสการพัฒนา |
| [decisions/adr-0001-stack-choice.md](decisions/adr-0001-stack-choice.md) | ADR เลือกเทคโนโลยี |
