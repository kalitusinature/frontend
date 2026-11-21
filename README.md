# Kalitusi Resort Admin Portal

React + TypeScript staff portal for managing the Kalitusi Resort menu, incoming
orders, categories, lodges, and reservation requests.

## Local development

```powershell
npm ci
npm run dev
```

The app uses the production API by default. To point it at another backend,
copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL`. This URL is
public configuration; never put staff passwords or API tokens in a Vite
environment file.

## Install on mobile

Deploy the app over HTTPS, then open it in a mobile browser. Android browsers
show an **Install app** action when the app is eligible; on iPhone or iPad, open
the app in Safari, tap **Share**, and choose **Add to Home Screen**. The app
shell and static assets are available offline after the first visit, but staff
sign-in and resort data still require a connection to the API.

## GitHub Pages deployment

The `frontend` repository is configured to build and deploy from the `main`
branch with GitHub Actions. In repository **Settings → Pages**, choose
**GitHub Actions** as the build and deployment source.

- **Default project site:** `https://kalitusinature.github.io/frontend/` (build with `VITE_BASE=/frontend/`)
- **Custom domain (e.g. `https://admin.kalitusi.com`):** build with `VITE_BASE=/` and configure the domain in GitHub Pages (add a `public/CNAME` file containing the domain so it persists across deploys). See [vite.config.ts](vite.config.ts) and [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

By default the app calls `https://api.kalitusi.com/api/v1` (see [src/api.ts](src/api.ts); override with `VITE_API_BASE_URL`) and signs staff in
through Django token authentication. The backend must include
`https://kalitusinature.github.io` in `CORS_ALLOWED_ORIGINS`. The browser
session token is stored in `sessionStorage` and is cleared on sign-out.

## Staff sections

- Dashboard with order and reservation totals and recent activity.
- Orders: search, filter, confirm, progress, and record payment at the resort.
- Menu products: create and edit products, pricing, categories, uploaded images, and visibility.
- Reservations: review, confirm, or decline lodge and cottage requests.
- Categories and lodges/cottages: create and edit public menu and stay inventory.

Only active Django staff users can obtain an API token. No credential or token
is compiled into the public GitHub Pages bundle.

Product image uploads are sent to the Django staff API and stored in Cloudinary.
Configure `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, and `CLOUDINARY_SECRET` on the
backend; the Cloudinary secret is never sent to the browser.
