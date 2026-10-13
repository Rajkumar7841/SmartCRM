# SmartCRM: CRM + WooCommerce integration

React (Vite) + Express + MySQL (mysql2/promise) + WooCommerce REST API + plain CSS.

## Requirements
- Node.js 18 or newer
- MySQL running locally (MySQL Server or XAMPP)

## Setup (3 terminals in VS Code)

### 1. Backend: Terminal 1
```bash
cd server
npm install
copy .env.example .env        # Mac/Linux: cp .env.example .env
```
Open `server/.env` and set `DB_PASSWORD` to your MySQL password (empty for XAMPP).
```bash
npm run db:setup              # creates database "smartcrm" + demo data (resets data if run again)
npm run dev                   # API on http://localhost:5000
```
Check: http://localhost:5000/api/health should say `"database":"connected"`.

### 2. Frontend: Terminal 2
```bash
cd client
npm install
npm run dev                   # app on http://localhost:5173
```

## Demo mode vs live WooCommerce
- If `WC_URL`, `WC_KEY`, `WC_SECRET` in `server/.env` are empty, the app runs in **DEMO MODE**.
  The Import button loads built-in sample data and the UI labels it as demo.
- To go live: fill those three values (WooCommerce, Settings, Advanced, REST API, key with Read permission), restart the backend, then use Test connection and Import on the WooCommerce page.
- API keys stay on the backend and are never sent to React.

## Email
- Without SMTP settings, "Send" is a **simulation**: the message is marked Simulated and no email is sent.
- Fill `SMTP_*` in `server/.env` to send real emails (badge shows "Emailed").

## Project layout
```
server/   Express API (routes/, services/woo.js, sql/schema.sql, sql/seed.sql, scripts/setup-db.js)
client/   React app (src/pages, src/components/ui.jsx, src/index.css)
```
