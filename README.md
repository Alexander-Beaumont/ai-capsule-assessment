# AI Capsule — Assessment 3

Student: Alexander Beaumont  
Public URL: https://ai-capsule-assessment.onrender.com  
Hosting: Render Free Node Web Service  
Repository: https://github.com/Alexander-Beaumont/ai-capsule-assessment

AI Capsule is a private prompt library. Users sign in with GitHub, then create, read, update and delete their own prompt records. React provides the interface, Express provides the API, and SQLite stores the records. Express serves the React production build and the API on the same origin.

## Verification status — complete the remaining checks before submission

On 26 September 2026, Render logs showed a successful build and live deployment. Browser screenshots showed the deployed dashboard signed in as Alexander-Beaumont and a saved “Fix Render build” capsule displaying version v2. These screenshots show the resulting state; the video must demonstrate the full operation sequence.

Direct HTTP checks performed by ChatGPT on 26 September 2026 against the public deployment returned:

| Check | Observed result |
| --- | --- |
| GET /api/health | HTTP 200; {"status":"ok"} |
| GET /api/capsules without a cookie | HTTP 401; {"error":"Unauthorized"} |
| GET /api/capsules with token=fake-token-123 | HTTP 401; {"error":"Unauthorized"} |

Local npm test output supplied by the student showed all four test groups passing. These tests exercise CRUD, owner isolation, token rejection, validation and a mocked OAuth exchange. Mocked tests do not authenticate with real GitHub accounts.

Remaining before submission: personally repeat and record the public HTTP checks; demonstrate create, refresh/read, edit and delete in the deployed UI; confirm the exposed development-session secrets have been replaced; record and review a 3–5 minute MP4 with audio; package the current source. Remove this pending checklist only after completing it, and describe what was actually verified. No final video has yet been reviewed.

## Requirements and installation

Use Node.js 24 or newer and npm. The student used Node 25.9.0 locally; the supplied Render logs reported Node 26.10.0. SQLite uses Node's built-in `node:sqlite` module. No separate database server or `better-sqlite3` installation is needed.

From the project directory:

```bash
npm ci --include=dev
cp .env.example .env
```

Set local environment values in `.env`. Use a GitHub OAuth App configured with Homepage URL `http://localhost:4000` and Redirect URI `http://localhost:4000/auth/github/callback`. Set local `APP_URL=http://localhost:4000`; do not use `NODE_ENV=production` for this HTTP local setup. A separate local OAuth App avoids changing the deployed OAuth App.

Generate a fresh local JWT secret, place it in `.env`, and keep it private:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npm test
npm run build
npm start
```

Open http://localhost:4000. This is the recommended local workflow because it serves frontend and backend together. SQLite creates `data/capsules.db` and its table/index automatically when the server starts. Stop the server with Ctrl+C.

## Render configuration

| Setting | Value |
| --- | --- |
| Service | Node Web Service |
| Branch | main |
| Root directory | Repository root, where package.json is located |
| Build command | npm ci --include=dev && npm run build |
| Start command | npm run start |
| Recommended health check path | /api/health |
| APP_URL | https://ai-capsule-assessment.onrender.com |
| GitHub OAuth Redirect URI | https://ai-capsule-assessment.onrender.com/auth/github/callback |

Render supplies the listening port. Express binds to `0.0.0.0` and uses `PORT`. Keep the service accessible during marking.

| Environment variable | Purpose |
| --- | --- |
| GITHUB_CLIENT_ID | Identifies the registered OAuth App |
| GITHUB_CLIENT_SECRET | Backend-only GitHub OAuth credential |
| JWT_SECRET | Backend signing key; at least 32 characters in production |
| APP_URL | Application origin without a trailing slash; HTTPS in production |
| NODE_ENV | production on Render |
| PORT | HTTP port assigned by Render; local default 4000 |
| DATABASE_PATH | Optional SQLite path; default ./data/capsules.db |

Real secret values belong only in local `.env` or Render environment settings. `.env` is excluded from Git. Do not place credentials, real JWTs or secret values in this README, screenshots or the video.

## Pages and API

| Route | Access and function |
| --- | --- |
| / | Public introduction |
| /login | Public route that begins GitHub OAuth |
| /dashboard | JWT-protected dashboard |
| /api/health | Public; returns {"status":"ok"} |
| GET /api/capsules | JWT required; returns own records |
| POST /api/capsules | JWT required; creates own record |
| PUT /api/capsules/:id | JWT required; updates own record |
| DELETE /api/capsules/:id | JWT required; deletes own record |
| /auth/github/start | Creates OAuth state and PKCE challenge; redirects to GitHub |
| /auth/github/callback | Checks state, exchanges code, reads GitHub identity and creates app JWT |
| GET /api/me | JWT required; returns login name |
| POST /logout | Clears the application session cookie |

React makes same-origin fetch requests and sends JSON for creation and updates. Express validates values and uses parameterised SQL. React never connects directly to SQLite.

## Authentication and record ownership

GitHub authenticates the user. Express exchanges the temporary OAuth code on the server, uses the provider access token to read the GitHub profile, and signs a separate application JWT. The application JWT is signed with HS256, expires after eight hours, and contains issuer, audience and subject claims. The subject is `github:<GitHub numeric ID>`.

The browser stores it in a cookie named `token`, with HttpOnly, SameSite=Lax and, on the deployed HTTPS app, Secure. React cannot read the HttpOnly cookie. There is no JWT in localStorage. The GitHub provider token is not the application JWT.

Shared authentication middleware calls jwt.verify before any capsule route. It validates the signature, expiration, issuer, audience and expected identity format. Missing or invalid JWTs receive 401. INSERT assigns ownership from the verified JWT. SELECT, UPDATE and DELETE constrain queries by that same identity. A browser-supplied user_id is not used. An authenticated attempt to edit or delete another owner's record receives 404.

Local tests cover two simulated identities: the second cannot read, update or delete the first identity's record. They also check that supplying a different user_id during creation cannot assign the record to that other identity. This is automated API evidence; it is not a claim that two real GitHub accounts were tested online.

## Data and storage decision

Each capsule stores id, user_id, project_name, prompt_title, prompt_version, prompt_text, response_summary, category, usefulness, reviewed, improved, screenshot_url, notes and created_at. An owner index supports account-scoped reads. Reviewed and improved are stored as 0 or 1, and created_at is generated by SQLite.

SQLite is sufficient for this small relational CRUD application and meets the assignment minimum. It avoids operating a separate database service. Compared with PostgreSQL, it is less suitable for multiple application instances and concurrent write-heavy workloads. PostgreSQL could keep data separate from the application filesystem, but would add database provisioning and connection configuration.

Limitation: Render Free uses an ephemeral filesystem. Saved SQLite records may disappear after a service restart or redeployment. A browser refresh alone does not restart the server. Screenshot evidence is an optional HTTPS URL; this app does not upload or host screenshot files.

## Required cURL evidence

Run these from a terminal and show them in the demonstration:

```bash
curl -i https://ai-capsule-assessment.onrender.com/api/capsules
curl -i -H 'Cookie: token=fake-token-123' https://ai-capsule-assessment.onrender.com/api/capsules
```

Both were independently observed to return HTTP 401 with `{"error":"Unauthorized"}` on 26 September 2026. Repeat them personally before recording; a browser login is not shared with these curl commands. Do not extract or display a real JWT.

## AI collaboration and personal work

ChatGPT helped generate the initial source, React interface, tests and documentation, and assisted with debugging installation and deployment. I configured the Git repository, GitHub OAuth App and Render service, entered environment settings, ran the local tests and build, and used the deployed interface. I remain responsible for understanding and explaining the submitted implementation.

Two problems arose in the AI-assisted setup. First, better-sqlite3 could not install on my Fedora system: its downloaded binary needed a newer GLIBC and the fallback compilation failed on spaces and parentheses in the path. I applied the change to Node's built-in SQLite module and updated the dependency files. Installation, tests and build then passed without moving my project or changing my Node version.

Second, setting NODE_ENV=production caused npm ci to omit Vite, producing “vite: not found”. I changed the Render build command to npm ci --include=dev && npm run build. The next deployment succeeded.

An implementation decision I can explain is serving the React build and Express API from one origin. The browser can send the application cookie to the API without configuring cross-origin access. The database limitation and verification status are described above. Add any further personal verification truthfully before submission.

## Submission

Submit a source ZIP and a 3–5 minute MP4 with working audio directly to the LMS. Include package.json, package-lock.json, .env.example, source and this README. Exclude node_modules, dist, .git, real .env files and local database files. Use the final working source from the repository, including the SQLite change, rather than the earlier downloaded ZIP.

The video must show the public URL, health JSON, both 401 cURL checks, GitHub OAuth login, complete CRUD, cloud runtime/build/start settings, environment-variable names with values concealed, SQLite's storage limitation, and one problem solved. Watch the exported and uploaded recording before submitting.

## References

- jsonwebtoken: https://www.npmjs.com/package/jsonwebtoken
- Course OAuth lab: https://github.com/CSE3CWA-5006/CSE3CWA-5006-Week-05
- GitHub OAuth flow: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Course deployment lab: https://github.com/CSE3CWA-5006/CSE3CWA-5006-Week-01
- Render Express deployment: https://render.com/docs/deploy-node-express-app
- Node SQLite: https://nodejs.org/api/sqlite.html
