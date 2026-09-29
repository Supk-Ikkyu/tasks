# Ikkyu Tasks

เว็บส่วนตัวสำหรับจัดการ Tasks, Notes, Important Links และ Calendar รองรับโทรศัพท์, iPad และ PC พร้อม Light/Dark mode และ Supabase authentication

## สิ่งที่ต้องมี

- Node.js LTS
- Git
- บัญชี GitHub
- บัญชี Supabase
- บัญชี Render

## 1. ติดตั้งโปรเจกต์

เปิดโฟลเดอร์นี้ด้วย VS Code แล้วเปิด Terminal:

```bash
npm install
```

## 2. สร้าง Supabase Project

1. เข้า https://supabase.com/dashboard
2. กด **New project**
3. ตั้งชื่อ `ikkyu-tasks`
4. สร้าง Database password ใหม่ที่ไม่ซ้ำกับบัญชีอื่น
5. เลือก region ที่อยู่ใกล้ประเทศไทย
6. รอให้ Project สร้างเสร็จ

## 3. สร้างฐานข้อมูล

1. ใน Supabase เลือก **SQL Editor**
2. กด **New query**
3. เปิดไฟล์ `supabase/schema.sql`
4. คัดลอกเนื้อหาทั้งหมดไปวาง
5. กด **Run**

ไฟล์นี้สร้างตารางและ Row Level Security ซึ่งจำกัดข้อมูลไว้ที่ `supk.ikkyu@gmail.com`

## 4. สร้างบัญชี Login เพียงบัญชีเดียว

1. ไปที่ **Authentication > Users**
2. กด **Add user > Create new user**
3. ใช้อีเมล `supk.ikkyu@gmail.com`
4. ตั้งรหัสผ่านใหม่ที่ไม่เคยส่งให้บุคคลอื่น
5. เปิด **Auto Confirm User**
6. สร้างผู้ใช้

จากนั้นไปที่ **Authentication > Providers > Email** และปิดตัวเลือกที่อนุญาตให้บุคคลทั่วไปสมัครสมาชิก หาก Dashboard เวอร์ชันที่ใช้อยู่แสดงตัวเลือกนี้

## 5. สร้างไฟล์ Environment

คัดลอก `.env.example` แล้วตั้งชื่อสำเนาว่า `.env`

ใน Supabase ไปที่ **Project Settings > API** แล้วคัดลอก:

- Project URL
- Publishable/anon key

ใส่ลงใน `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
VITE_ALLOWED_EMAIL=supk.ikkyu@gmail.com
```

ค่า anon/publishable key สามารถใช้ใน frontend ได้เมื่อเปิด RLS ถูกต้องแล้ว แต่ห้ามนำ `service_role` key มาใส่ในเว็บเด็ดขาด

## 6. เปิดเว็บบนเครื่อง

```bash
npm run dev
```

เปิด URL ที่ Terminal แสดง โดยปกติคือ:

```text
http://localhost:5173
```

## 7. ตรวจสอบก่อนอัปโหลด

```bash
npm run build
```

ถ้าสำเร็จ จะมีโฟลเดอร์ `dist`

## 8. อัปโหลดขึ้น GitHub

สร้าง repository ชื่อ `ikkyu-tasks` และตั้งเป็น **Private** จากนั้นรัน:

```bash
git init
git add .
git commit -m "Initial Ikkyu Tasks application"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ikkyu-tasks.git
git push -u origin main
```

ไฟล์ `.env` ถูกป้องกันไม่ให้อัปโหลดโดย `.gitignore`

## 9. Deploy บน Render

1. Render Dashboard > **New > Static Site**
2. เชื่อม repository `ikkyu-tasks`
3. Build Command: `npm ci && npm run build`
4. Publish Directory: `dist`
5. เพิ่ม Environment Variables ทั้งสามค่าจากไฟล์ `.env`
6. กด Deploy

สำหรับ Single Page Application ให้เพิ่ม Rewrite rule:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

## การแจ้งเตือน

Calendar สามารถแสดง browser notification เมื่อเว็บไซต์ยังเปิดอยู่และได้รับอนุญาตจาก browser แล้ว การแจ้งเตือนขณะปิดเว็บไซต์ต้องเพิ่ม Web Push และ server-side scheduler ในเวอร์ชันถัดไป

## แผนต่อยอด

- Google Calendar OAuth sync
- Background push notifications
- OpenAI API สำหรับแนะนำตารางและแบ่งงาน

API keys ของ Google, OpenAI หรือ `service_role` ต้องเก็บฝั่ง server เท่านั้น ห้ามใช้ตัวแปรที่ขึ้นต้นด้วย `VITE_`
