# PARTS MARKET — Full E-commerce Starter

বাংলাদেশি মোটরসাইকেল পার্টস স্টোরের জন্য responsive storefront + secure admin portal.

## Included
- Product catalogue, search and category filters
- Shopping cart and checkout (Cash on Delivery)
- Supabase database-backed products and orders
- Admin email/password login
- Admin product create/edit/delete, stock control and image upload
- Admin order list and status updates
- SQL-side order validation and stock decrement
- Row Level Security (RLS)

## 1. Supabase সেটআপ
1. https://supabase.com এ একটি project তৈরি করুন।
2. SQL Editor খুলে `supabase-schema.sql`-এর সম্পূর্ণ SQL রান করুন।
3. Project Settings → API থেকে Project URL এবং `anon` / publishable key কপি করুন।
4. `config.example.js` কপি করে `config.js` নাম দিন এবং দুইটি মান বসান।
   - `config.js` public হবে; এখানে কখনো `service_role` key দেবেন না।
5. Authentication → Users থেকে অ্যাডমিনের email/password user তৈরি করুন।
6. ওই user-এর UUID নিয়ে SQL Editor-এ চালান:
   ```sql
   insert into public.profiles(id, role)
   values ('PASTE_AUTH_USER_UUID', 'admin')
   on conflict (id) do update set role='admin';
   ```
7. Supabase Authentication → URL Configuration-এ আপনার deployed site URL এবং redirect URL যোগ করুন।

## 2. লোকালি চালানো
`index.html`, `styles.css`, `app.js`, `config.js` একই ফোল্ডারে রাখুন। VS Code Live Server অথবা `python -m http.server 8000` দিয়ে চালান। সরাসরি file:// দিয়ে না চালানোই ভালো।

## 3. GitHub Pages
1. GitHub-এ একটি public repository তৈরি করুন (যেমন `parts-market-store`)।
2. এই ফোল্ডারের ফাইলগুলো repository root-এ upload/commit করুন।
3. `Settings → Pages → Build and deployment → Deploy from a branch` নির্বাচন করুন।
4. Branch `main`, folder `/ (root)` নির্বাচন করে Save করুন।
5. কয়েক মিনিট পর GitHub Pages URL-এ সাইট চালু হবে।
6. Supabase URL Configuration-এ সেই Pages URL যোগ করুন।

## 4. Vercel
1. GitHub repository Vercel-এ import করুন।
2. Framework preset `Other`, Build Command ফাঁকা, Output Directory `.` দিন।
3. Deploy করুন। `config.js` commit করে রাখতে পারেন, কারণ এতে কেবল public anon key থাকবে; অথবা build-time config strategy ব্যবহার করুন।
4. Supabase URL Configuration-এ Vercel domain যোগ করুন।

## Admin
ওয়েবসাইটের নিচের ডান পাশে ⚙ চাপুন → admin email/password দিয়ে login করুন।
Admin role SQL দিয়ে assign না করলে লগইন করলেও প্যানেল খুলবে না।

## গুরুত্বপূর্ণ সীমাবদ্ধতা / production checklist
- Checkout এখন Cash on Delivery; bKash/Nagad/card gateway যুক্ত করা হয়নি।
- অর্ডার কনফার্মেশন SMS/email, delivery charge rules, coupon, customer account, refund workflow এখনো যুক্ত নয়।
- Launch-এর আগে privacy policy, terms, return policy, delivery policy যোগ করুন।
- Supabase dashboard-এ database backups, usage limits, rate limiting/anti-spam এবং project billing review করুন।
- Admin account-এ শক্তিশালী unique password ও MFA ব্যবহার করুন।
- Sample products শুধু demo; Supabase configure করলে database-এ থাকা products দেখাবে।
- Brand logo ও social QR codes যুক্ত করতে `assets/`-এ ফাইল দিন এবং header/footer markup আপডেট করুন।

## Security
`anon` key browser-এ থাকা স্বাভাবিক; নিরাপত্তা RLS policies ও RPC validation-এর উপর নির্ভর করে। কখনো `service_role` key frontend-এ রাখবেন না।
