# a_Perfect Web

Vue 3 + TypeScript + Vite + Tailwind CSS frontend for the a_Perfect reservation system.

## Build

```bash
pnpm install
pnpm build
```

Output: `dist/`.

## EdgeOne Pages

- Root directory: `/`
- Install command: `pnpm install`
- Build command: `pnpm build`
- Output directory: `dist`
- Node.js: `22.17.1`

Environment variables:

```env
VITE_API_BASE_URL=https://api.example.com/api/v1
VITE_CAPTCHA_APP_ID=your-captcha-app-id
```

`VITE_CAPTCHA_ENABLED` defaults to true in production. Set it to `false` only for local development.

The backend URL must include `/api/v1`. The app uses hash routing, so no SPA rewrite is required.

## Booking rules

Edit `src/content/booking-rules.md` to change the rules shown before Tencent Captcha. The dialog enforces a 5-second countdown before the captcha button is enabled. Rebuild the frontend after editing the Markdown file.
