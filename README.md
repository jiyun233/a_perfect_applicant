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

Tencent's popup is attached to `body`. During verification, the booking dialog closes visually to release Reka's outside-pointer and focus locks. The form state stays mounted in `BookingDialog`; a separate backdrop and an inert application prevent clicks reaching the page. The SDK instance is destroyed on success, cancellation, failure, or navigation. Do not add a global `body { pointer-events: auto !important }` override: it defeats other modal interactions.

Dialogs keep their header and actions visible while the content scrolls, and track the visual viewport when a mobile keyboard opens. Inputs, menus, cards, and filter grids adapt to the available width, with larger touch targets on touch devices.

## Responsive and captcha regression checks

```bash
pnpm test:responsive
```

The script starts its own Vite server and uses the installed Chrome browser (override its path with `CHROME_PATH`). It uses local API fixtures and a simulated Tencent SDK with a cross-origin iframe; it does not create real reservations or bypass production verification. It checks public/admin layouts at 320, 390, 640, 768, 1024, and 1440 pixels plus landscape, dialog actions, select bounds, touch/mouse dragging, focus, cancellation, retries, stale callbacks, network failure, and rejected submissions. Screenshots are saved under `screenshots/responsive-captcha/`. Real Tencent challenges and native mobile keyboards still need device testing on the configured deployment domain.
