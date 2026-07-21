# OnTarget — لوحة تحكم عمليات الدفع

لوحة تحكم React + Vite لمراقبة وإدارة عمليات بوابة الدفع OnTarget، متصلة مباشرة بـ Supabase.

## الصفحات

- **المراقبة** (`/monitor`) — عمليات الدفع لحظيًا مع فلاتر وإحصائيات
- **الرسائل المباشرة** (`/smslive`) — آخر 200 رسالة SMS واردة من الأجهزة
- **استرجاع** (`/recovery`) — مطابقة العمليات المرفوضة برسائل SMS واسترجاعها
- **المحافظ** (`/wallets`) — إدارة حسابات المحافظ وربطها بالأجهزة
- **الإعدادات** (`/settings`) — ضبط قواعد المطابقة والأتمتة

## المتطلبات

- Node.js 18+

## الإعداد

```bash
npm install
```

انسخ `.env.example` إلى `.env` وتأكد من قيم Supabase:

```bash
cp .env.example .env
```

## التشغيل محليًا

```bash
npm run dev
```

## البناء للإنتاج

```bash
npm run build
```

الناتج في مجلد `dist/`.

## النشر على Vercel

```bash
npm i -g vercel
vercel deploy --prod
```

يحتوي المشروع على `vercel.json` لإعادة توجيه كل المسارات إلى `index.html` (SPA routing)، ومتغيرات البيئة `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` يجب إضافتها في إعدادات المشروع على Vercel.

## اختصارات لوحة المفاتيح

- `R` — تحديث بيانات الصفحة الحالية
