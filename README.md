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

Environment variable:

```env
VITE_API_BASE_URL=https://api.example.com/api/v1
```

The backend URL must include `/api/v1`. The app uses hash routing, so no SPA rewrite is required.
