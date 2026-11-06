# Clothing Store — Retail + Wholesale E-commerce

A complete online store for a clothing shop that sells **retail and wholesale**. It includes an **admin panel**, a **chatbot trained on the store's data**, and **WhatsApp integration**.

| Part | Tech | Folder |
|---|---|---|
| Storefront + Admin panel | Next.js 16 (App Router), React 19, Tailwind CSS | `frontend/` |
| REST API | Node.js 20+, Express 5, Mongoose | `backend/` |
| Database | MongoDB (local or MongoDB Atlas) | — |

---

## Seller requirements → what's built

| Seller asked for | Where it is |
|---|---|
| **1. Bulk inventory** for Tops, Dresses, Pants, Denims, Shorts, Skirts, each with types (Bodyfit / Comfort fit / Plus size, Spaghetti / Sleeveless / Half / Full sleeves, Short / Full length / Gown, Korean / Formal / Casual…) | *Admin → Categories* holds main categories, their types and filters (Sleeve, Fit, Rise, Wash, Style, Occasion). The shop shows them as menus and filters. |
| **Batch upload, with every item getting its own description** | *Admin → Bulk upload*: **From photos** (drop 50–100 photos, choose category, price and sizes once; each photo or photo group becomes a product) or **From Excel/CSV** (template provided; photos are matched by SKU or file name). Names, descriptions and tags are written automatically (template-based, or AI if `ANTHROPIC_API_KEY` is set). Re-uploading the sheet updates stock and prices by SKU. Photos are compressed in the browser before upload. |
| **2. WhatsApp: select, order and checkout** | Customer says "Hi" or "MENU" and gets categories → types → styles (with photo, price and sizes) → size → quantity → cart → address → **Cash on Delivery / Razorpay payment link / confirm later**. Free-text search ("black bodyfit top") returns tappable products. Carts sent from the WhatsApp catalogue (retailer ID = SKU or `SKU__SIZE`) are supported. |
| **3. Instagram, WhatsApp and website linked** | `/links` page for the Instagram bio, a "Shop on WhatsApp" link and QR code, "Order on WhatsApp" and "Share" buttons on every product, Instagram DM auto-replies, and an Instagram feed on the website. Every order is tagged **Website / WhatsApp / Instagram** (*Admin → Instagram & links*). |
| **4. Notification on my mobile for any order on any platform** | The admin panel installs as the **Seller app** on Android or iPhone (Add to Home Screen). Push notifications arrive for every order from every channel, plus low-stock and payment-received alerts. While the app is open there is also a live order sound and toast, plus an optional WhatsApp alert to the owner. |
| **5. Inventory management on the mobile app** | *Seller app → Stock*: search, filters (low stock / out of stock / hidden), +/− per size, set stock, change price, hide or show, and a bottom tab bar built for phones. |

### Seller app setup (one time)
1. On the server, run `cd backend && npm run vapid` and put the two keys into `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, then restart.
2. On the seller's phone, open `https://yourstore.com/admin` in **Chrome (Android)** or **Safari (iPhone)** and log in.
3. Tap **Install app** (Android) or **Share → Add to Home Screen** (iPhone, iOS 16.4+), then open the app from the home screen.
4. Tap **Enable order notifications**, then **Send test**.

### WhatsApp shopping setup
Set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET`, and point the Meta webhook to `/api/whatsapp/webhook` (subscribe to `messages`). For "Pay online" inside WhatsApp, also set the Razorpay keys; customers then receive a Razorpay payment link, and payment is confirmed automatically.
Note: WhatsApp only displays **JPG/PNG** product photos (the SVG demo artwork is sent as text).

### Instagram setup
Use an Instagram professional account connected to the same Meta app. Set `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_ACCOUNT_ID` and subscribe the same webhook to Instagram `messages`. DMs get instant replies with products, the website and the WhatsApp shop link, and the latest posts appear on the website and the `/links` page.

## Features

**Storefront**
- Premium home page: banner slider, categories, bestsellers, new arrivals and a wholesale section
- Shop page with filters (category, size, price), sorting, search and "load more"
- Product page with an image gallery, sizes and stock, colours, an "Ask on WhatsApp / Get video" button and related products
- Cart and checkout. Prices, stock, MOQ and coupons are always recalculated on the server.
- Payment by **Razorpay** (UPI, cards, net-banking), **Cash on Delivery**, or **Confirm on WhatsApp** (sends the full order summary to the shop's WhatsApp)
- Order confirmation and tracking page, plus a customer account with order history and a saved address
- Fully responsive on mobile

**Wholesale**
- Wholesale registration (business name, GSTIN). The admin approves the account.
- Approved buyers see **wholesale prices** and the **MOQ** on every product. Retail customers never receive wholesale prices from the API.
- The MOQ is per style and buyers can mix sizes. You can also set a minimum order value for wholesale.

**Chatbot (website + WhatsApp)**
- Floating "Need help?" assistant with product cards, quick replies and a **Continue on WhatsApp** hand-off
- It answers from live store data:
  - **Order tracking** by order number, or by the sender's phone number on WhatsApp
  - **Product search** in plain language ("cotton kurti under 1000", "red saree", "linen shirt")
  - Wholesale/MOQ, shipping, returns, payment, sizes and contact questions, all taken from the Store settings
  - A **trainable knowledge base**: the owner adds Q&A entries and keywords in *Admin → Chatbot*. Hindi and Hinglish keywords work.
  - **Optional AI** for free-form questions (set `ANTHROPIC_API_KEY`). AI answers stay grounded in the store's data.
- **WhatsApp Business Cloud API** (optional):
  - The same bot replies to customers on WhatsApp automatically
  - The owner gets a WhatsApp alert for every new order
  - Customers get an order confirmation and updates when the status changes (shipped messages include tracking)

**Admin panel** (`/admin`)
- Dashboard: revenue split by retail and wholesale, a 14-day sales chart, pending orders, wholesale requests and low-stock alerts
- Products: add and edit with multiple image uploads (drag & drop, reorder), size presets with stock per size, colours, retail and wholesale price, MOQ, tags, and featured/visible switches
- Categories with sub-categories (e.g. Women → Kurtis, Sarees, Lehengas; Men → Shirts, Kurtas; Kids → Girls, Boys), shown as a mega-menu in the store
- Coupons (percent or flat, minimum order, cap, expiry, usage limit, retail/wholesale)
- Orders: filters and search, status updates (stock goes back automatically on cancel), courier and tracking, payment status, a WhatsApp button to message the customer, and a printable invoice
- Customers: approve or reject wholesale buyers, upgrade a customer to wholesale, block a customer, message them on WhatsApp
- Chatbot & WhatsApp: train the bot, test it live, on/off switches, connection status
- Store settings: name, banners, announcement bar, WhatsApp number, shipping fees, policies, payment options

---

## Quick start (local)

Requires **Node.js 20+** and **MongoDB** (local install or a free MongoDB Atlas cluster).

```bash
# 1) API
cd backend
cp .env.example .env        # set MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run seed                # creates the admin, settings, demo categories/products, coupon, chatbot FAQ
npm run dev                 # http://localhost:5000

# 2) Storefront + admin
cd ../frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev                 # http://localhost:3000
```

- Store: http://localhost:3000
- Admin: http://localhost:3000/admin, logging in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env` (default `admin@store.com` / `Admin@123`, **change before going live**)
- Demo coupon: `WELCOME10`
- Bulk upload template: *Admin → Bulk upload → From Excel / CSV → Template*

The demo products use placeholder artwork. Replace it with real photos from *Admin → Products*, or reset the demo catalogue with `npm run seed -- --fresh` (this wipes products, orders, coupons and FAQs).

### With Docker (one command)
```bash
cp backend/.env.example backend/.env    # edit values
docker compose up -d --build
docker compose exec backend node src/seed.js
```

---

## Going live (recommended setup)

| What | Where |
|---|---|
| Database | MongoDB Atlas (free M0 is enough to start) |
| Backend | Render / Railway / any VPS (`npm start`) |
| Frontend | Vercel (root directory `frontend`) or the same VPS (`npm run build && npm start`) |
| Images | Set the `CLOUDINARY_*` variables. Most hosts delete local files on redeploy, so don't rely on local storage in production. |

**Backend env (production):**
- `NODE_ENV=production`
- `MONGODB_URI` set to your Atlas URI
- `JWT_SECRET` set to a long random string
- `CLIENT_URL` and `STORE_URL` set to `https://yourstore.com`
- `PUBLIC_URL` set to `https://api.yourstore.com`
- Optional: `CLOUDINARY_*`, `RAZORPAY_*`, `WHATSAPP_*`, `ANTHROPIC_API_KEY`

**Frontend env:**
- `NEXT_PUBLIC_API_URL=https://api.yourstore.com`
- `NEXT_PUBLIC_SITE_URL=https://yourstore.com`

### Razorpay
Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. "Pay online" then appears at checkout automatically. Payments are verified on the server by signature.

### WhatsApp Business Cloud API (auto-reply bot and order alerts)
1. Go to developers.facebook.com, create an app, and add the **WhatsApp** product.
2. Copy the **Phone number ID** and a **permanent access token** (System User) into `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TOKEN`.
3. Choose any secret word for `WHATSAPP_VERIFY_TOKEN`. Put your app secret in `WHATSAPP_APP_SECRET`, which is used to verify that webhook messages really come from Meta.
4. In WhatsApp → Configuration, set the webhook URL to `https://api.yourstore.com/api/whatsapp/webhook`, use the same verify token, and subscribe to **messages**.
5. In *Admin → Store settings*, set the owner's WhatsApp number (with country code, e.g. `919876543210`).

Without the Cloud API, every WhatsApp button still works through click-to-chat (`wa.me`) links, and the website chatbot works fully.

### AI answers (optional)
Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`). The bot only uses AI when the trained answers, store topics and product search can't answer. AI replies are grounded in the store's settings, FAQ and matching products.

---

## API overview

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | public |
| GET/PUT | `/api/auth/me` | logged in |
| GET | `/api/products` · `/api/products/:slug` | public (wholesale price only for approved wholesale/admin) |
| POST/PUT/DELETE | `/api/products[/:id]` | admin |
| GET/POST/PUT/DELETE | `/api/categories` | public read / admin write |
| POST | `/api/orders/quote` · `/api/orders` | public (guest or logged in) |
| GET | `/api/orders/mine` · `/api/orders/:id?key=` | owner / key holder / admin |
| GET/PUT | `/api/orders` · `/api/orders/:id` | admin |
| POST | `/api/payments/razorpay/create` · `/verify` | order owner |
| POST | `/api/coupons/validate` | public |
| GET/PUT | `/api/settings` | public read / admin write |
| POST | `/api/upload` | admin |
| GET/PUT | `/api/admin/stats` · `/api/admin/users` | admin |
| POST | `/api/chatbot/message` | public (rate limited) |
| CRUD | `/api/chatbot/faqs` | admin |
| GET/POST | `/api/whatsapp/webhook` | Meta (WhatsApp + Instagram) |
| POST | `/api/products/bulk` | admin: create/update many products |
| GET | `/api/products/export` | admin: inventory CSV |
| PATCH | `/api/products/:id/stock` | admin: quick stock/price/visibility |
| GET/POST | `/api/push/public-key` · `/subscribe` · `/test` | seller app notifications |
| GET | `/api/social/instagram` | latest Instagram posts |
| GET | `/api/payments/razorpay/link-callback` | Razorpay payment links |

## Project structure
```
backend/src
  models/       User, Product, Category, Order, Coupon, Setting, FaqEntry, WaSession, PushSubscription
  routes/       auth, products, bulk, categories, orders, payments, coupons, settings, upload, admin, chatbot, whatsapp, push
  utils/        botEngine (chatbot), waShop (WhatsApp shopping), whatsapp, instagram, push, notify,
                describe (auto descriptions), razorpayLinks, coupon, helpers
  seed.js
frontend/
  app/(store)/  home, shop, product/[slug], cart, checkout, order/[id], account, wholesale, contact
  app/admin/    login + (panel)/ dashboard, orders, inventory, products, bulk, categories, customers,
                coupons, chatbot, channels, settings   (installable Seller app: /seller-manifest + public/seller-sw.js)
  app/links/    Instagram link-in-bio page
  components/   Header, Footer, ProductCard, HeroSlider, ChatWidget, AuthForm, admin/*
  lib/          api client, cart/auth store, formatting, cart quote hook
```
