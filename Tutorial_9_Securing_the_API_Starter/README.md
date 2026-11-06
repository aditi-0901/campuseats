# CampusEats – Securing the API (CS543 Tutorial 9)

**Course:** CS543 – Web Services  
**Institute:** IIIT Vadodara  
**Tutorial:** Tutorial 9 – Securing the API  
**Project:** CampusEats Secured Catalogue API

## 1. Project Overview

This project demonstrates how to secure a REST API using JWT authentication and role-based authorization.

The application provides:
- Password hashing using `bcryptjs`.
- User login and JWT generation.
- Authentication middleware to verify JWT tokens.
- Role-based authorization using middleware.
- Protected API endpoints.
- Input validation for new menu items.
- Environment-based storage of the JWT signing secret.

## 2. Technologies Used

- Node.js
- Express.js
- JSON Web Token (`jsonwebtoken`)
- bcryptjs
- dotenv
- REST API
- Git Bash / cURL for API testing

## 3. Project Setup

### Prerequisites

- Node.js and npm installed.
- Git Bash or another terminal.

### Installation

Clone or download the project and open its directory in the terminal.

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Generate a secure JWT secret:

```bash
openssl rand -hex 32
```

Copy the generated value into `.env`:

```env
JWT_SECRET=your_generated_secret
PORT=3000
```

**Important:** Never commit or publicly share `.env`. It contains the private JWT signing secret.

### Start the server

```bash
npm start
```

Expected message:

```text
Secured Catalogue on http://localhost:3000
```

## 4. Seed User Accounts

The application creates two demo users at startup. Passwords are hashed using bcrypt.

| Email | Password | Role |
|---|---|---|
| neha@campus.edu | neha123 | customer |
| mealhub@campus.edu | resto123 | restaurant |

These are demonstration credentials, not production accounts.

## 5. API Endpoints

| HTTP Method | Endpoint | Access | Expected Response |
|---|---|---|---|
| POST | `/login` | Public | 200 OK |
| GET | `/items` | Authenticated users | 200 OK |
| POST | `/items` | Restaurant/Admin | 201 Created |

### POST /login

Accepts the user's email and password, verifies the password using bcrypt, and returns a signed JWT.

The JWT contains:
- `sub`: User ID
- `role`: User role
- Expiration: 1 hour

### GET /items

Requires a valid JWT in the Authorization header.

```text
Authorization: Bearer <token>
```

Any authenticated user can view the menu.

### POST /items

Requires authentication and the `restaurant` or `admin` role.

Example request:

```json
{
  "name": "Masala Dosa",
  "price": 85
}
```

Successful response: `201 Created`.

If the name is missing, the API returns `422 Unprocessable Entity`.

## 6. Authentication and Authorization

### Authentication Middleware

The `auth` middleware:
1. Reads the JWT from the Authorization header.
2. Verifies the token using the secret key.
3. Attaches the verified payload to `req.user`.
4. Returns `401 Unauthorized` if the token is missing, invalid, or expired.

### Authorization Middleware

The `requireRole()` middleware checks whether the authenticated user's role is permitted to access a particular endpoint.

For example:

```js
app.post(
  '/items',
  auth,
  requireRole('restaurant', 'admin'),
  handler
);
```

A user with an unauthorized role receives `403 Forbidden`.

## 7. Security Features Implemented

1. **Password Hashing:** Passwords are stored as bcrypt hashes rather than plaintext.
2. **JWT Authentication:** Signed tokens identify authenticated users.
3. **Token Expiration:** JWTs expire after one hour.
4. **Environment Variables:** The JWT secret is loaded from `.env`.
5. **Role-Based Authorization:** Only restaurant and admin roles can add menu items.
6. **Input Validation:** Missing item names are rejected with HTTP 422.
7. **Git Protection:** `.env` is excluded through `.gitignore`.

## 8. API Testing Results

The following tests were performed using cURL:

| No. | Test Case | Expected HTTP Status | Result |
|---|---|---|---|
| 1 | GET items without a token | 401 Unauthorized | PASS |
| 2 | Customer login | 200 OK | PASS |
| 3 | Customer accesses menu with JWT | 200 OK | PASS |
| 4 | Restaurant login | 200 OK | PASS |
| 5 | Restaurant adds a menu item | 201 Created | PASS |
| 6 | Customer attempts to add a menu item | 403 Forbidden | PASS |
| 7 | Restaurant submits an item without a name | 422 Unprocessable Entity | PASS |
| 8 | Verify final menu contents | 200 OK | PASS |
| 9 | Recheck login and authenticated access after JWT secret change | 200 OK | PASS |

## 9. Important Security Concepts

- **401 Unauthorized:** Authentication is missing or invalid.
- **403 Forbidden:** The user is authenticated but does not have permission.
- **422 Unprocessable Entity:** The request data fails validation.
- **HTTPS:** Production APIs should use HTTPS to protect credentials and tokens in transit.
- **JWT Signature:** Modifying a signed token invalidates its signature unless the signing secret is known.
- **IDOR:** Applications should verify resource ownership and permissions, not rely only on authentication.

JWT payloads are encoded, not encrypted. Sensitive information such as passwords should never be stored in them.

## 10. Project Structure

```text
Tutorial_9_Securing_the_API_Starter/
│
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── README.md
├── screenshots/
└── node_modules/
```

The actual `.env` file is created locally and must not be committed or included in a publicly shared submission ZIP.

## 11. Screenshots

The `screenshots/` directory contains terminal evidence of the API testing process, including successful authentication, authorization failures, input validation, and final menu verification.

---

**CS543 – Web Services | IIIT Vadodara**  
**Tutorial 9 – Securing the API**