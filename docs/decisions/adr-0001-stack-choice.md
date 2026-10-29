# ADR-0001: Stack Choice — Payload 3 + Postgres over Sanity

> บันทึกการตัดสินใจเชิงสถาปัตยกรรม: เหตุใดจึงเลือก Payload 3 + Postgres แทน Sanity

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** ทีมพัฒนา

## Context (บริบท)

ระบบต้องการ:
- Admin UI สำหรับจัดการ master data (นักเรียน, ห้อง, ครู)
- ระบบ auth + role-based access control ในตัว
- โครงสร้างข้อมูลเชิงสัมพันธ์ (นักเรียน × วันที่ × สถานะการเช็คชื่อ)
- โฮสต์ร่วมกับ Next.js บน Vercel ได้ง่าย

## Decision (การตัดสินใจ)

เลือก **Payload 3** (รันในแอป Next.js เดียวกัน) + **Postgres ผ่าน Neon**

## Rationale (เหตุผล)

- **ข้อมูลเชิงสัมพันธ์** — การเช็คชื่อเป็นความสัมพันธ์ many-to-many ตามวันที่ เหมาะกับ Postgres มากกว่า document store ของ Sanity
- **Auth + RBAC ในตัว** — Payload ให้ระบบ auth และ access-control functions พร้อมใช้ จำกัด query เป็น `advisor === currentUser` ได้ตรงไปตรงมา
- **Co-hosting** — Payload 3 รันในแอป Next.js เดียวกัน ลดความซับซ้อนในการ deploy บน Vercel
- **API หลายรูปแบบ** — Local / REST / GraphQL พร้อมใช้
- **ควบคุม schema** — Postgres adapter ให้ควบคุมโครงสร้างและ migration ได้ชัดเจน

## Alternatives considered (ทางเลือกที่พิจารณา)

- **Sanity** — เป็น document-based CMS เหมาะกับ content มากกว่าข้อมูลเชิงสัมพันธ์; การทำ RBAC แบบ scoped ต่อห้องและ query เชิงสัมพันธ์ซับซ้อนกว่า

## Consequences (ผลที่ตามมา)

- ✅ โครงสร้างข้อมูลและสิทธิ์ตรงกับความต้องการของระบบเช็คชื่อ
- ✅ Deploy ง่ายบน Vercel + Neon
- ⚠️ ต้องจัดการ Postgres migration เมื่อ schema เปลี่ยน
- ⚠️ ทีมต้องคุ้นเคยกับ Payload 3 (เวอร์ชันใหม่)

## Related

- Tech stack: [../03-architecture/tech-stack.md](../03-architecture/tech-stack.md)
- Data model: [../03-architecture/data-model.md](../03-architecture/data-model.md)
