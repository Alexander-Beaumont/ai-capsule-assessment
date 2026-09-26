# AI Capsule — Assessment 3

**Student:** Alexander Beaumont  
**Public URL:** https://ai-capsule-assessment.onrender.com  
**Hosting:** Render Free Node Web Service  
**Repository:** https://github.com/Alexander-Beaumont/ai-capsule-assessment  

AI Capsule is a private prompt library. After signing in with GitHub, a user can create, read, update and delete their own prompt records. React provides the interface, Express provides the API and authentication flow, and SQLite stores the records. Express serves the React production build and API from the same public origin.

Firebase Authentication and a custom username/password registration system are not used. The assessed Express-side OAuth-to-JWT flow is used instead.

## Verification summary

The current source is the `main` branch revision beginning `88327f2`. The source was checked with Node.js 24 and npm:

```text
npm ci --include=dev    passed
npm test                4 test groups passed
npm run build           passed
```

The deployed service was checked on 26 September 2026:

| Check | Result |
| --- | --- |
| `GET /` | Public landing page loaded over HTTPS |
| `GET /api/health` | HTTP 200; `{"status":"ok"}` |
| `GET /api/capsules` without a cookie | HTTP 401; `{"error":"Unauthorized"}` |
| `GET /api/capsules` with `token=fake-token-123` | HTTP 401; `{"error":"Unauthorized"}` |
| GitHub OAuth | Completed successfully on the deployed application |
| Authenticated dashboard CRUD | Create, refresh/read, edit and delete verified |

The cURL checks were run against the public Render URL, not a localhost server. No real JWT is included in this README or the source repository.

## Local requirements and setup

Requirements:

- Node.js 24 or newer
- npm
- A GitHub OAuth App for local development

From the project directory:

```bash
npm ci --include=dev
cp .env.example .env
```

Set the local values in `.env`. Use a separate GitHub OAuth App for local development so the production callback URL does not need to be changed:

```text
GITHUB_CLIENT_ID=<local OAuth application ID>
GITHUB_CLIENT_SECRET=<local OAuth application secret>
JWT_SECRET=<fresh random local signing secret>
APP_URL=http://localhost:4000
DATABASE_PATH=./data/capsules.db
PORT=4000
```

Configure the local OAuth App with:

```text
Homepage URL: http://localhost:4000
Authorization callback URL: http://localhost:4000/auth/github/callback
```

Generate a local signing secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run the automated tests, build the React frontend and start the production-style local server:

```bash
npm test
npm run build
npm start
```

Open `http://localhost:4000`.

For development with Vite hot refresh, use:

```bash
npm run dev
```

The Vite development server runs on port 5173 and proxies `/api`, `/auth`, `/login` and `/logout` to Express on port 4000. The recommended deployment-style local test is `npm run build` followed by `npm start`, because it uses the same-origin arrangement used on Render.

SQLite creates the `data/capsules.db` file, tables and index automatically when the server starts. Stop the server with Ctrl+C.

## Render deployment

The deployed service is a Render Node Web Service using the repository root.

| Render setting | Value |
| --- | --- |
| Service type | Web Service |
| Runtime | Node |
| Branch | `main` |
| Root directory | Repository root |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm run start` |
| Health-check path | `/api/health` |
| Application URL | `https://ai-capsule-assessment.onrender.com` |

Render supplies the `PORT` environment variable. Express binds to `0.0.0.0` and uses that port.

The production GitHub OAuth App uses this exact callback URL:

```text
https://ai-capsule-assessment.onrender.com/auth/github/callback
```

Configure these environment-variable names in Render. Secret values belong only in Render’s environment settings and must never be committed:

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth application identifier |
| `GITHUB_CLIENT_SECRET` | Server-only GitHub OAuth credential |
| `JWT_SECRET` | Express application-JWT signing key; at least 32 characters in production |
| `APP_URL` | Exact application origin, including `https://` and no trailing slash |
| `NODE_ENV` | `production` on Render |
| `PORT` | Port assigned by Render |
| `DATABASE_PATH` | Optional SQLite file path; default is `./data/capsules.db` |

Never place OAuth secrets, JWT secrets, database passwords or real JWT values in GitHub, README files, screenshots or the video. Any credential accidentally exposed during development must be revoked and replaced before submission.

## Pages and API routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Explains AI Capsule and provides the GitHub sign-in link |
| `/login` | Public | Starts GitHub OAuth |
| `/dashboard` | Protected | Displays the signed-in user’s capsules and CRUD interface |
| `GET /api/health` | Public | Returns `{"status":"ok"}` |
| `GET /api/capsules` | JWT required | Reads the authenticated user’s records |
| `POST /api/capsules` | JWT required | Creates a record for the authenticated user |
| `PUT /api/capsules/:id` | JWT required | Updates the authenticated user’s record |
| `DELETE /api/capsules/:id` | JWT required | Deletes the authenticated user’s record |
| `GET /api/me` | JWT required | Returns the authenticated GitHub login |
| `POST /logout` | Same-origin request | Clears the application session cookie |

React makes same-origin JSON requests with `fetch`. React never connects directly to SQLite. Express validates request data, runs parameterised SQL and returns JSON responses.

## OAuth, JWT and protection

1. `/login` redirects to `/auth/github/start`.
2. Express creates a random OAuth state value and a PKCE verifier/challenge.
3. GitHub authenticates the user and redirects to `/auth/github/callback`.
4. Express verifies the state, exchanges the temporary code server-side and reads the GitHub profile.
5. Express signs a separate application JWT. The GitHub provider access token is not used as the application JWT.
6. The application JWT is stored in a cookie named `token`.

The application JWT uses HS256, expires after eight hours, and contains:

- issuer: `ai-capsule`
- audience: `ai-capsule-web`
- subject: `github:<numeric GitHub ID>`

The `token` cookie is `HttpOnly`, `SameSite=Lax` and `Secure` on the deployed HTTPS application. The token is not stored in `localStorage`, and the frontend cannot read its contents.

The shared authentication middleware verifies the signature, algorithm, expiry, issuer, audience and subject format before any capsule route runs. Missing or invalid tokens return HTTP 401. The authenticated identity comes from the verified JWT; the frontend cannot choose the owner.

The database queries enforce ownership:

- `INSERT` assigns `user_id` from the verified JWT.
- `SELECT` filters by the verified JWT identity.
- `UPDATE` requires both the record ID and verified owner ID.
- `DELETE` requires both the record ID and verified owner ID.

An authenticated attempt to edit or delete another user’s record returns 404. Mutation requests also reject foreign browser origins.

## Data model and storage decision

SQLite is implemented using Node’s built-in `node:sqlite`; no native SQLite npm addon is required. The database is initialised automatically by `server/db.js`.

Each capsule contains:

```text
id
user_id
project_name
prompt_title
prompt_version
prompt_text
response_summary
category
usefulness
reviewed
improved
screenshot_url
notes
created_at
```

An index on `(user_id, created_at)` supports owner-scoped reads. `reviewed` and `improved` are stored as SQLite integers `0` or `1`, and `created_at` is generated by SQLite.

SQLite is appropriate for this small single-service relational CRUD application and satisfies the assignment minimum. Compared with PostgreSQL, it is less suitable for multiple application instances and high-concurrency write workloads. PostgreSQL would provide a more independent and scalable database service but would require additional provisioning and connection configuration.

The Render Free filesystem is ephemeral. SQLite records may disappear after a service restart or redeployment. This is an intentional documented limitation of the free deployment. A persistent disk or managed PostgreSQL database would be appropriate for a production system.

Screenshot evidence is stored as an optional HTTPS URL. The application does not upload or host screenshot files.

## Required cURL evidence

Run these commands from a terminal while the service is deployed:

```bash
curl -i https://ai-capsule-assessment.onrender.com/api/capsules

curl -i \
  -H 'Cookie: token=fake-token-123' \
  https://ai-capsule-assessment.onrender.com/api/capsules
```

Both requests must return:

```text
HTTP 401 Unauthorized
{"error":"Unauthorized"}
```

The first request checks that authentication is required. The second checks that the server validates the JWT instead of merely checking whether a cookie exists. Do not extract or display a real JWT.

## Automated and live verification

The automated tests in `server/app.test.js` cover:

- public health response;
- missing and fake-token rejection;
- server-assigned ownership;
- owner-scoped read, update and delete;
- malformed capsule validation;
- foreign-origin mutation rejection;
- issuer/audience validation;
- OAuth state and PKCE initiation;
- mocked GitHub code exchange;
- Secure, HttpOnly application-token issuance.

The deployed application was also tested through the public Render URL. A temporary capsule was created, read after a page refresh, edited and deleted. An HTTP screenshot URL was rejected and an HTTPS screenshot URL was accepted.

## AI collaboration statement

ChatGPT assisted with the initial application structure, React interface, Express routes, tests, README drafting and deployment debugging. I configured the Git repository, GitHub OAuth App, Render service and environment-variable names; ran the local tests and build; ran the deployed cURL checks; used the deployed dashboard; and reviewed the final implementation. I remain responsible for understanding and explaining the submitted code.

Two problems were identified and corrected during development:

1. `better-sqlite3` could not install on my Fedora system because its downloaded binary required a newer GLIBC version and its fallback compilation failed when the project path contained spaces and parentheses. I changed the implementation to Node’s built-in `node:sqlite` module and updated the dependency files. I kept Node.js 25 and did not move the project. Installation, tests and the build then passed.
2. When Render used production dependency installation, Vite was omitted and the build failed with `vite: not found`. I changed the Render build command to `npm ci --include=dev && npm run build`. The next deployment built successfully.

The main implementation decision was to serve the React build and Express API from one origin. This allows the browser to send the HttpOnly application cookie to the API without cross-origin cookie configuration. SQLite was selected because it is sufficient for the small assignment and requires no separate database service; its Render Free persistence limitation is documented above.

## Video demonstration checklist

The required submission video is a 3–5 minute MP4 with working audio. It must show the deployed application, not localhost:

1. Open `https://ai-capsule-assessment.onrender.com`.
2. Open `/api/health` and show `{"status":"ok"}`.
3. Run the cURL request without a cookie and show HTTP 401.
4. Run the cURL request with `token=fake-token-123` and show HTTP 401.
5. Complete GitHub OAuth login.
6. Open the protected dashboard.
7. Create a capsule.
8. Show the saved record (READ), refresh if possible, edit it and save (UPDATE), then delete it (DELETE).
9. Show Render build/start settings and environment-variable names only. Conceal all values.
10. Explain SQLite’s ephemeral Render Free storage and one deployment issue that was solved.

Do not display a real JWT, OAuth secret, JWT secret or database password. Watch the exported MP4 and the uploaded LMS copy to confirm that both video and audio work.

## Submission contents

Submit both files directly to the LMS:

- one source-code ZIP containing `package.json`, `package-lock.json`, `.env.example`, source files and this README;
- one 3–5 minute MP4 with working audio.

Exclude `node_modules`, `dist`, `.git`, `.env`, local database files and generated dependencies from the source ZIP.

## References

- [jsonwebtoken documentation](https://www.npmjs.com/package/jsonwebtoken)
- [Course GitHub OAuth lab](https://github.com/CSE3CWA-5006/CSE3CWA-5006-Week-05)
- [GitHub OAuth web application flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Course Render deployment lab](https://github.com/CSE3CWA-5006/CSE3CWA-5006-Week-01)
- [Render Node/Express deployment guide](https://render.com/docs/deploy-node-express-app)
- [Node.js SQLite documentation](https://nodejs.org/api/sqlite.html)
