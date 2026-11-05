# CampusEats Menu — Securing the REST API

**CS543 Web Services · Assignment 9**  
**Faculty:** Dr. Pramit Mazumdar · IIIT Vadodara

A secured REST API for the CampusEats Menu service using Node.js, Express.js, JWT authentication and role-based authorization.

## Team

| Roll No. | Name |
|---|---|
| 20251651008 | Aditi Garg |
| 20251651084 | Shivam Kumar Soni |
| 20251651064 | Neha Nupur |

## How to Run

**1. Clone the repository**

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

**2. Navigate to the project folder**

```bash
cd Assignment_9
```

**3. Install dependencies**

```bash
npm install
```

**4. Configure environment variables**

Create a `SECRET` variable.

```env
SECRET='dev-secret-change-me'
PORT=3000
```

**5. Start the server**

```bash
node server.js
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Video and Screenshots

**Google Drive Demonstration Video:**

[Watch CampusEats API Demonstration](https://drive.google.com/file/d/1ot1YrTbYlrbPXAYgfCIw4TrQYrnIVe_m/view?usp=sharing)

**Screenshots:** Available in the `Screenshoots/` folder.

The demonstration covers all five required test cases:

1. **401 Unauthorized** – Accessing the menu without a token.
2. **Login** – Successful restaurant login and JWT generation.
3. **200 OK** – Accessing menu items using a valid JWT.
4. **201 Created** – Restaurant successfully adding a new menu item.
5. **403 Forbidden** – Customer trying to add a menu item.

## Project Structure

```text
Assignment_9/
│
├── node_modules/
├── public/
│
├── Screenshoots/
│   ├── Access without login.png
│   ├── Adding Item.png
│   ├── Adding Item.png
│   └── restro Authorization.png
│
├── .gitignore
├── package.json
├── package-lock.json
├── server.js
├── .env.example
└── README.md
```

## Features

- REST API using Node.js and Express.js.
- JWT-based authentication.
- Password hashing using bcryptjs.
- Authentication middleware (`auth`).
- Role-based authorization (`requireRole`).
- Customer and Restaurant roles.
- Protected API routes.
- Input validation and error handling.
- In-memory menu data storage.

## API Endpoints

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/login` | Login and generate JWT | Public |
| GET | `/items` | Get all menu items | Authenticated users |
| GET | `/items/:id` | Get a specific menu item | Authenticated users |
| POST | `/items` | Add a new menu item | Restaurant only |

## Demo Login Credentials

| Role | Email | Password |
|---|---|---|
| Customer | shivam@campus.edu | customer123 |
| Restaurant | mealhub@campus.edu | resto123 |

Passwords are hashed using bcryptjs.

# Answers

### 1. Which routes require only authentication, and which also require a role?

The API uses two middleware functions: `auth` and `requireRole()`.

| Method | Path | Middleware | Allowed User |
|---|---|---|---|
| POST | `/login` | No authentication | Public |
| GET | `/items` | `auth` | Any authenticated user |
| GET | `/items/:id` | `auth` | Any authenticated user |
| POST | `/items` | `auth` + `requireRole('restaurant')` | Restaurant only |

The `auth` middleware verifies the JWT token, while `requireRole()` checks whether the authenticated user has permission to perform the requested operation.

### 2. Show one 401 and one 403 from your demo. Why did the server return that code?

**Case 1: 401 Unauthorized**

Request:

```http
GET /items
```

Response:

```json
{
  "error": "invalid or missing token"
}
```

**Reason:** The server returned 401 because the request did not contain a valid JWT token. The user was not authenticated.

**Case 2: 403 Forbidden**

Request:

```http
POST /items
```

Response:

```json
{
  "error": "forbidden"
}
```

**Reason:** The server returned 403 because the customer had a valid JWT and was authenticated, but did not have the restaurant role required to add menu items.

**Difference:** 401 means the user is not authenticated, whereas 403 means the user is authenticated but does not have permission.

### 3. What is inside your JWT payload? Why is it safe to trust the role claim on the server, and why must the secret stay out of your code?

The JWT payload contains:

```json
{
  "sub": 2,
  "role": "restaurant",
  "iat": 1793890000,
  "exp": 1793893600
}
```

- `sub` – User ID.
- `role` – User role (customer or restaurant).
- `iat` – Token issued-at timestamp.
- `exp` – Token expiration timestamp.

The role claim is safe to trust after successful JWT verification because the token is digitally signed using the server's secret key. If someone modifies the payload, the signature becomes invalid and `jwt.verify()` rejects the token.

The secret must stay out of the source code because anyone who obtains it can generate valid tokens and potentially impersonate users with higher permissions. Therefore, the secret is stored in `.env` and excluded from GitHub using `.gitignore`.

## API Testing

The following commands were used to test the API through Windows Command Prompt.

**1. GET without token (401)**

```cmd
curl -i http://localhost:3000/items
```

**2. Login as Restaurant**

```cmd
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d "{\"email\":\"mealhub@campus.edu\",\"password\":\"resto123\"}"
```

**3. Set Restaurant JWT**

```cmd
set "TOKEN=YOUR_RESTAURANT_TOKEN"
```

**4. GET items with token (200)**

```cmd
curl -i http://localhost:3000/items -H "Authorization: Bearer %TOKEN%"
```

**5. Add item as Restaurant (201)**

```cmd
curl -i -X POST http://localhost:3000/items -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"name\":\"Masala Dosa\",\"price\":60}"
```

**6. Login as Customer**

```cmd
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d "{\"email\":\"shivam@campus.edu\",\"password\":\"customer123\"}"
```

**7. Set Customer JWT**

```cmd
set "TOKEN=YOUR_CUSTOMER_TOKEN"
```

**8. Try adding an item as Customer (403)**

```cmd
curl -i -X POST http://localhost:3000/items -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"name\":\"Hack Burger\",\"price\":99}"
```

## Testing Results

| Test Case | Expected Result |
|---|---|
| GET without token | 401 Unauthorized |
| Restaurant login | 200 OK + JWT |
| GET with valid token | 200 OK |
| POST as Restaurant | 201 Created |
| POST as Customer | 403 Forbidden |

All five required demonstration cases were tested successfully.

## Security Implementation

- Passwords are hashed using bcryptjs.
- JWT tokens expire after one hour.
- Protected routes verify tokens before processing requests.
- Only restaurant users can add menu items.
- JWT secret is stored in environment variables.
- `.env` is excluded from GitHub using `.gitignore`.
- HTTPS should be used in production.

## Learning Outcomes

Through this assignment, we learned:

- Implementing JWT authentication in Express.js.
- Hashing and verifying passwords using bcryptjs.
- Creating authentication middleware.
- Implementing role-based authorization.
- Securing REST API endpoints.
- Understanding the difference between 401 and 403.
- Using environment variables to protect sensitive information.

---

**Course:** CS543 – Web Services  
