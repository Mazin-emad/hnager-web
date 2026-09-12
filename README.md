# هناجر النبل — نظام الفواتير (Hangar Al-Nobel Invoice Web)

Arabic RTL web app for the Invoice Calculator .NET API: invoices (draft → finalize → PDF),
product catalog with formula items, variables, users/roles admin, and account management.

## Stack

Vite 8 + React 19 + TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · TanStack Query ·
React Router · React Hook Form + Zod · Axios · Sonner toasts

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Copy the API URL into `.env.local` (already set for production):

```bash
VITE_API_URL=https://invoice-calculator.runasp.net
```

## Scripts

| Command          | What                              |
|------------------|-----------------------------------|
| `npm run dev`    | Local dev server                  |
| `npm run build`  | Type-check (`tsc -b`) + prod build to `dist/` |
| `npm run preview`| Serve the production build        |
| `npm run lint`   | oxlint                            |

## Publish

`npm run build` produces a static `dist/` folder. Client-side routing needs an
SPA fallback — already configured:

- **Vercel**: `vercel.json` rewrites everything to `index.html`
- **Netlify / others**: `public/_redirects` (`/* /index.html 200`)
- **IIS / static host**: add a URL-rewrite rule pointing unknown paths to `index.html`

Set `VITE_API_URL` in the host's environment variables (Vercel/Netlify) or
rebuild with the right `.env.production` value. The API must allow the site's
origin (CORS) and stay reachable over HTTPS.

## Notes & assumptions

- UI is Arabic-first, RTL, Western digits (`0123`), money shown in `ج.م`.
- Auth: Bearer JWT + refresh-token rotation (stored in memory + `localStorage`);
  a 401 triggers one silent refresh, then logout. Login returns a bare
  `AuthResponse`; refresh returns a `Result<AuthResponse>` wrapper (handled in
  `src/api/errors.ts`).
- Role/permission UI gating reads JWT claims (`role`/`roles`, `permission`/
  `permissions`, incl. .NET long claim names); Admins pass all checks.
  The API enforces authorization server-side — UI gating is display-only.
- `GET /api/v1/products/{id}` / `configuration` variable entries: the code
  accepts embedded `variableKey/variableName/unit` and falls back to the
  variables catalog by `variableId` (`displayVar` in `ProductDetailPage`).
  If the server's embedding differs, adjust `AssignedProductVariable` in
  `src/api/types.ts`.
- `docs/openapi.json` is a snapshot of the live OpenAPI spec for reference.
