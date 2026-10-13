VELLUNE NETLIFY + ONLINE ORDERS

This version keeps the Vellune design and uses a Netlify Function + Netlify Blobs for shared online orders.

UPLOAD:
1. Upload the CONTENTS of this folder to the ROOT of your GitHub repository.
2. Deploy that repository on Netlify.
3. Keep netlify.toml, package.json and netlify/functions/api.js in the repository root.
4. Netlify will install @netlify/blobs and deploy the API automatically.

PAGES:
- /              -> index.html
- /website.html  -> Vellune storefront
- /admin         -> admin.html
- /api/health    -> backend health check
- /api/orders    -> online order API

ORDER FLOW:
Customer -> Place Order -> /api/orders -> Netlify Blobs -> Admin Orders

No Supabase key is required for this version.

IMPORTANT:
Do not mix these files with the previous localStorage-only Vellune version. Replace the old files with this complete package.
