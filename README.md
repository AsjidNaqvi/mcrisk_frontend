# CRM risk simulator (Vite + React + TypeScript)
## Run locally
1. Start the backend: `python -m uvicorn mcrisk.api:app --reload` (port 8000)
2. `npm install && npm run dev` (dev server proxies `/api` to the backend; set `BACKEND_URL` to change it)
The app uploads the CRM project and S0/M1/M2 automatically if the backend has no projects.
## Deploy on Vercel
1. Host the backend somewhere online (e.g. Render: `uvicorn mcrisk.api:app --host 0.0.0.0 --port $PORT`).
2. Put its URL in `vercel.json` (replacing YOUR-BACKEND.onrender.com). Vercel then forwards `/api/*` to it, so no CORS change is needed.
   (Alternative: set `VITE_API_URL` to the backend URL and ask IT1 to add `CORSMiddleware`.)
3. Import the repo in Vercel (framework: Vite). Build `npm run build`, output `dist`.
