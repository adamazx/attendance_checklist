# Tech Stack & Architecture (สถาปัตยกรรมและเทคโนโลยี)

> เทคโนโลยีหลักของระบบ: Next.js + TypeScript + Payload 3 + Postgres (Neon) + Vercel

## Stack overview

| Layer | Choice | หมายเหตุ |
|-------|--------|----------|
| **Framework** | Next.js (App Router) + TypeScript | UI ครูและ routing |
| **Backend / CMS** | Payload 3 (รันในแอป Next.js เดียวกัน) | admin UI สำหรับ master data, auth + RBAC ในตัว, Local/REST/GraphQL API |
| **Database** | Postgres ผ่าน Neon | เหมาะกับข้อมูลเชิงสัมพันธ์ของการเช็คชื่อ; ใช้ Payload Postgres adapter |
| **Custom UI** | Next.js server/client components | flow การเช็คชื่อรายวัน (admin ของ Payload ทั่วไปเกินไปสำหรับงานรายวัน) |
| **Charts** | Recharts หรือ Chart.js | กราฟแดชบอร์ด |
| **Deploy** | Vercel | โฮสต์ Next + Payload ร่วมกัน; Neon เป็น DB |
| **Auth** | Payload auth (email/username + password) | RBAC ผ่าน access-control functions จำกัด query เป็น `advisor === currentUser` |

## Key architectural decisions

- **Payload 3 co-hosted in Next.js** — ได้ admin UI สำหรับข้อมูลหลัก (นักเรียน/ห้อง/ครู), ระบบ auth และ RBAC พร้อมใช้ และ API หลายรูปแบบในแอปเดียว
- **Postgres over document DB** — ข้อมูลการเช็คชื่อเป็นเชิงสัมพันธ์ (นักเรียน × วันที่ × สถานะ) จึงเหมาะกับ relational model ดูเหตุผลเต็มที่ [ADR-0001](../decisions/adr-0001-stack-choice.md)
- **Custom roll-call UI** — หน้าเช็คชื่อสร้างเองด้วย Next.js components เพื่อ UX แบบ one-tap ไม่พึ่ง Payload admin
- **RBAC scoping** — บังคับใช้ที่ชั้น access-control เพื่อให้ครูที่ปรึกษาเห็นเฉพาะห้องของตน

## Related docs

- Data model: [data-model.md](data-model.md)
- Diagrams (ERD / flow): [diagrams/](diagrams/)
- Deployment: [../06-deployment/deployment.md](../06-deployment/deployment.md)
