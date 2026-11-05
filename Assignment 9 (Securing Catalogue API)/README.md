# CampusEats Catalogue API — Securing the API

**CS543 · Web Services · Assignment 9 of 12**  
**IIIT Vadodara · Dr. Pramit Mazumdar**

## Team

| Roll Number | Name |
|---|---|
| 20251651008 | Aditi Garg |
| 20251651084 | Shivam Kumar Soni |
| 20251651064 | Neha Nupur |

## Assignment objective

This project extends the existing Assignment 8 **Catalogue / Menu service**. It does not introduce a new service. The existing `GET /items`, `GET /items/:id`, and `POST /items` routes are retained. JWT authentication is required for catalogue reads, and only the `restaurant` or `admin` role can create catalogue items.

## Requirements completed

1. Two seeded users with different roles are stored with bcrypt password hashes.
2. `POST /login` checks credentials using `bcrypt.compareSync` and returns a signed JWT with an expiry.
3. The `auth` middleware reads the `Authorization: Bearer <token>` header and verifies the JWT. Missing, malformed, invalid, or expired tokens receive `401`.
4. `requireRole(...)` checks the authenticated user's role. A customer attempting to create an item receives `403`.
5. The JWT secret is read from `process.env.JWT_SECRET`. `.env` is ignored by Git and `.env.example` is committed with a blank secret.
6. The five required demonstration cases are: `401`, successful login/token, authenticated `200`, privileged `201`, and non-privileged `403`.

## Demo accounts

These are classroom demonstration accounts. Passwords are stored in the source as bcrypt hashes, not as plain-text values.

| Username | Password to enter at login | Role | Permission |
|---|---|---|---|
| `customer` | `customer123` | `customer` | Read catalogue |
| `restaurant` | `restaurant123` | `restaurant` | Read and create catalogue items |

The password values above are supplied only so the evaluator can test the seeded demo accounts. Do not reuse them in a real deployment.

## Project structure

```text
Assignment 9 - Securing Catalogue API/
├── public/
│   ├── index.html
│   └── style.css
├── test/
│   └── security.test.js
├── demo/
│   └── DEMO-CAPTURE-GUIDE.md
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

The existing Catalogue frontend and stylesheet are retained in `public/`. The page now provides a login form and sends the bearer token with catalogue requests.

## Installation and execution

Requirements: Node.js 18 or later and npm.

1. Open this project folder in VS Code.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a local `.env` file by copying `.env.example`.
4. Put a long, random value after `JWT_SECRET=` in `.env`. For example, generate one in PowerShell:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Start the service:

   ```bash
   npm start
   ```

6. Open <http://localhost:3000>.

Do not commit `.env`. Commit `.env.example`, which intentionally has a blank secret value.

## API routes and access rules

| Method | Path | Authentication | Role authorization | Success |
|---|---|---|---|---|
| POST | `/login` | Not required | Not required | `200` with JWT |
| GET | `/items` | Required | Any authenticated role | `200` |
| GET | `/items/:id` | Required | Any authenticated role | `200` |
| POST | `/items` | Required | `restaurant` or `admin` | `201` |

The service currently has no PUT or DELETE route in the Assignment 8 Catalogue starter. No new update/delete endpoint has been added.

## Answer the questions in the assignment PDF

### 1. Which route(s) require only authentication, and which also require a role?

- `GET /items` — requires authentication only; any valid authenticated user, such as `customer` or `restaurant`, can read the catalogue.
- `GET /items/:id` — requires authentication only; any valid authenticated user can read one catalogue item.
- `POST /items` — requires authentication and role authorization; only `restaurant` or `admin` can create a catalogue item.
- `POST /login` — public route; it is used to obtain a JWT and therefore does not require a token.

### 2. Show one 401 and one 403 from your demo. Why did the server return that code?

- `401 Unauthorized`: `GET /items` was sent without an `Authorization: Bearer <token>` header. Authentication failed because the request did not prove the caller's identity.
- `403 Forbidden`: `POST /items` was sent with a valid customer token. Authentication succeeded, but the customer's role is not permitted to create catalogue items.

The distinction is that `401` means the request is not authenticated, while `403` means the caller is authenticated but lacks permission.

### 3. What is inside your JWT payload? Why is it safe to trust the role claim on the server, and why must the secret stay out of your code?

The JWT payload contains the user's `id` and `role`; `jsonwebtoken` also adds the standard `iat` (issued-at) and `exp` (expiry) claims. The server trusts the role only after `jwt.verify` validates the token's signature using the server-side secret. A client cannot change the role claim and create a valid signature without knowing the secret. The secret must remain outside the source code so it is not exposed in a public repository, screenshots, or version history. The `.env` file is ignored by Git; `.env.example` contains only a blank value.

## Status code summary

| Status | Meaning in this service |
|---|---|
| `200` | Login succeeded, or an authenticated user read catalogue data |
| `201` | An authenticated `restaurant` or `admin` created an item |
| `400` | Malformed JSON body |
| `401` | Login credentials are incorrect, or a protected request has a missing/invalid/expired token |
| `403` | Authenticated user does not have an allowed role for the write route |
| `404` | Requested item ID does not exist |
| `422` | New item has a missing/invalid name or price |

## Automated tests

Run:

```bash
npm test
```

The tests exercise the missing-token `401`, invalid login `401`, successful login for both roles, authenticated catalogue `200`, customer write rejection `403`, and restaurant item creation `201`.

## Required demonstration evidence

The assignment requires a short demo video and screenshots for these five cases:

1. `401` — protected request without a token.
2. Login — successful `POST /login` response containing a JWT.
3. `200` — protected `GET /items` request with a valid token.
4. `201` — `POST /items` using the restaurant token.
5. `403` — `POST /items` using the customer token.
