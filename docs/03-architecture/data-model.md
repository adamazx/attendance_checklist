# Data Model (โครงสร้างข้อมูล)

> เอนทิตีหลักของระบบ: AcademicYear, Term, Classroom, Teacher, Student, AttendanceRecord, AttendanceSession, AuditLog

## Entities (เอนทิตี)

### AcademicYear (ปีการศึกษา)
- ปีการศึกษา เช่น 2569
- `isActive` — ปีที่ใช้งานอยู่

### Term (ภาคเรียน)
- ภาคเรียนที่ 1 หรือ 2
- วันที่เริ่ม/สิ้นสุด (start/end dates)

### Classroom (ห้องเรียน)
- ระดับชั้น (ม.1–ม.6 / ป. หากจำเป็น)
- หมายเลขห้อง
- ปีการศึกษา
- ครูที่ปรึกษา (advisor(s))

### Teacher (ครู)
- ผูกกับบัญชีผู้ใช้ (linked user account)
- บทบาท (role)
- ห้องเรียนที่ได้รับมอบหมาย (assigned classrooms)

### Student (นักเรียน)
- เลขประจำตัว (student ID)
- คำนำหน้า / ชื่อ / นามสกุล (prefix / first / last name)
- เลขที่ (class no.)
- ห้องเรียน
- สถานะ: กำลังศึกษา (studying) / ย้าย (transferred) / ลาพัก (on-leave) / จบ (graduated)

### AttendanceRecord (บันทึกการเช็คชื่อ)
- นักเรียน
- วันที่
- สถานะ: **มา** (present) / **สาย** (late) / **ลา** (leave) / **ขาด** (absent)
- เหตุผล (optional reason)
- `recordedBy`, `recordedAt`

### AttendanceSession *(optional)*
- ต่อห้อง ต่อวัน: ใครเป็นผู้เช็คชื่อ, ธงล็อก (lock flag)

### AuditLog (บันทึกการเปลี่ยนแปลง)
- entity, action (create / edit / backdate)
- actor, timestamp
- ค่าก่อน → หลัง (before → after)

## Design note (ข้อควรระวังในการออกแบบ)

> ทำให้ **status เป็น enum ที่แก้ไขได้** เพื่อให้โรงเรียนเพิ่มสถานะ **กิจกรรม** (กิจกรรม) หรือแยก "ลา" เป็น ลาป่วย / ลากิจ ได้ภายหลัง

## Relationships (ความสัมพันธ์)

- AcademicYear 1—* Term
- AcademicYear 1—* Classroom
- Classroom *—* Teacher (ผ่านการมอบหมายที่ปรึกษา)
- Classroom 1—* Student
- Student 1—* AttendanceRecord
- Classroom + Date 1—1 AttendanceSession (optional)
- ทุกการเปลี่ยนแปลงสำคัญ → AuditLog

ERD และ flow diagram เก็บไว้ที่ [diagrams/](diagrams/)
