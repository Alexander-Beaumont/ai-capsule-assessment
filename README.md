# AI Capsule — Cloud-Deployed AI Prompt Manager

A React and Express prompt library with GitHub OAuth, an Express-issued JWT cookie, and SQLite storage. Each capsule belongs to the GitHub account ID verified during OAuth. The browser never sends an owner ID that the API uses.

## Deployment status and evidence

**Public URL:** To be added after deployment: `https://YOUR-SERVICE.onrender.com`  
**Platform:** Render Web Service (planned).  
**Live OAuth and deployed cURL results:** Pending GitHub OAuth App registration and deployment. Do not claim this part is complete before checking it at the public URL.  
**Video:** Record and submit a 3–5 minute MP4 with working audio from your own signed-in browser. This source ZIP and the MP4 must both be uploaded to the LMS.

## Local setup

Requires Node.js 22+ and npm. In the project directory:

```bash
npm ci
cp .env.example .env
# Edit .env and provide the GitHub OAuth App credentials and a long random JWT_SECRET.
npm run build
npm start
```

Visit `http://localhost:4000`; the local callback URL is `http://localhost:4000/auth/github/callback`. Register that URL under GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. Set Homepage URL to `http://localhost:4000`. For development with separate Vite and Express processes, run `npm run dev` and visit `http://localhost:5173`; the Vite proxy forwards `/api` and `/login` to Express. Building and using port 4000 is recommended for testing the exact deployment architecture. Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Never commit `.env`.

`npm test` runs backend tests covering authentication rejection, owner isolation, CRUD, validation, and OAuth state initiation. Test SQLite data is kept in memory and does not affect your real database. `/api/health` should return `{"status":"ok"}`.

## Cloud deployment — Render

1. Put this source in a private or public Git repository. Ensure `.env`, `data/*.db`, `node_modules`, and `dist` are absent. Create a **GitHub OAuth App** with Homepage URL `https://YOUR-SERVICE.onrender.com` and Authorization callback URL `https://YOUR-SERVICE.onrender.com/auth/github/callback`. A separate OAuth App for local development avoids repeatedly changing callback settings.
2. Create a Render **Web Service** from the repository. Set runtime to **Node**, build command `npm ci && npm run build`, start command `npm start`. Render assigns `PORT`; Express listens on it. Set health check path `/api/health` where supported. Do not deploy as a static site: Express must run alongside the built React app.
3. Set Render environment-variable **names** `NODE_ENV=production`, `APP_URL=https://YOUR-SERVICE.onrender.com`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `JWT_SECRET`, and optionally `DATABASE_PATH`. Put secret **values** only in Render's environment settings. For Render's ephemeral filesystem, the default `./data/capsules.db` works but may be erased by a redeploy or restart. A Render persistent disk with `DATABASE_PATH=/var/data/capsules.db` is possible on a qualifying plan; check current pricing before selecting it.
4. Deploy, open the public root and `/api/health`, perform OAuth and full CRUD through `/dashboard`, and run the two cURL checks below. Keep the service available through marking. Update this README with the actual URL, platform, response codes and any real deployment issue you solved before submission.

Environment variables: `GITHUB_CLIENT_ID` (OAuth application identifier), `GITHUB_CLIENT_SECRET` (server-only OAuth credential), `JWT_SECRET` (server signing key, at least 32 characters in production), `APP_URL` (exact public origin, HTTPS in production), `DATABASE_PATH` (SQLite file path), `PORT` (hosting platform's HTTP port), `NODE_ENV` (`production` in cloud). Only names belong in screenshots.

## Routes and architecture

| Route | Access | Function |
| --- | --- | --- |
| `/` | Public | React introduction |
| `/login` | Public | Begins GitHub OAuth |
| `/dashboard` | JWT required | Serves React dashboard; React also checks `/api/me` |
| `/api/health` | Public | `{"status":"ok"}` |
| `GET /api/capsules` | JWT required | List own capsules |
| `POST /api/capsules` | JWT required | Create a capsule |
| `PUT /api/capsules/:id` | JWT required | Update own capsule |
| `DELETE /api/capsules/:id` | JWT required | Delete own capsule |

React fetches same-origin `/api` URLs. The browser automatically sends the HttpOnly `token` cookie; React cannot read its contents. `/login` creates a random OAuth `state` and PKCE challenge. The callback checks `state`, exchanges the temporary code on the backend, fetches `/user` from GitHub, and signs an 8-hour application JWT whose subject is `github:<numeric GitHub ID>`. The JWT has a fixed issuer, audience and HS256 algorithm. Every CRUD route verifies it before queries. INSERT assigns `user_id` from the verified JWT, and SELECT, UPDATE and DELETE include `WHERE user_id = ?` in parameterised SQL. Invalid and missing tokens return 401. Updates and deletes to another account's ID return 404. The short-lived OAuth state and verifier cookies and session cookie are HttpOnly and SameSite=Lax. Cookies gain `Secure` when `APP_URL` is HTTPS, as required for the deployed app. Mutations reject foreign browser origins.

SQLite initialises `capsules` and the owner index automatically at startup. Records contain project, title, version, prompt, response summary, category, usefulness, reviewed, improved, screenshot URL, notes and timestamp. The production database's durability depends on the hosting filesystem; Render's default filesystem is ephemeral. There is no screenshot file upload: evidence is an optional HTTPS URL.

## Required deployed checks

Replace the host with the real deployed URL and record the HTTP status actually obtained:

```bash
curl -i https://YOUR-SERVICE.onrender.com/api/capsules
# Observed after deployment: [fill in]; expected HTTP 401 Unauthorized
curl -i -H 'Cookie: token=fake-token-123' https://YOUR-SERVICE.onrender.com/api/capsules
# Observed after deployment: [fill in]; expected HTTP 401 Unauthorized
```

Locally `npm test` exercises the same API rejection and ownership rules with an in-memory database, but actual deployed results must be collected independently. Verify both authenticated accounts see only their own records if two GitHub accounts are available. Never print a real JWT.

## AI collaboration statement — revise to reflect your actual work

AI tool: ChatGPT assisted with the first implementation, test cases, UI design and this deployment guide. A security issue identified and corrected during implementation was that a permitted localhost Origin on the deployed server could allow a foreign-origin mutation; the origin check now allows the Vite localhost origin only in local mode. Authentication, ownership and validation were checked through local automated tests; real GitHub OAuth and deployed API behavior still need personal verification. The implementation decision is to serve the React build from Express on the same origin, avoiding cross-origin cookie configuration. **Before submitting**, add what you personally configured, tested, understood and changed; replace the pending verification statements with truthful findings. Limitation: on Render's default filesystem, SQLite data can disappear after redeploy or restart.

## Video checklist

Show the deployed HTTPS address and `/api/health`, both no-cookie and fake-cookie cURL responses (401), GitHub sign-in, dashboard, creating then reading a capsule, editing it and deleting it, Render runtime/build/start settings and environment-variable **names only**, and briefly explain SQLite persistence and one real deployment issue. Do not show secret values or a real JWT. Watch the uploaded MP4 and check its audio before submitting.

## References

- [Assignment 3 PDF](https://lms.latrobe.edu.au/pluginfile.php/13215480/mod_page/content/19/AI_Capsule_Assignment_3_Revised.pdf)
- [jsonwebtoken documentation](https://www.npmjs.com/package/jsonwebtoken)
- [Course GitHub OAuth lab](https://github.com/CSE3CWA-5006/CSE3CWA-5006-Week-05)
- [GitHub OAuth web application flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Course Render deployment lab](https://github.com/CSE3CWA-5006/CSE3CWA-5006-Week-01)
- [Render Node/Express deployment](https://render.com/docs/deploy-node-express-app)
