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

## GitHub Pages deployment

The `frontend` repository is configured to build and deploy from the `main`
branch with GitHub Actions. In repository **Settings → Pages**, choose
**GitHub Actions** as the build and deployment source. Successful deployments
will be available at:

`https://kalitusinature.github.io/frontend/`

The app calls `https://backend-bte7.onrender.com/api/v1` and signs staff in
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
