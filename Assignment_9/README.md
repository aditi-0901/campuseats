# CampusEats Menu — Securing the REST API (JWT Authentication & Authorization)

**CS543 Web Services · Assignment 9** · Dr. Pramit Mazumdar · IIIT Vadodara

**How to run:** `npm install && node server.js`, then open [http://localhost:3000](http://localhost:3000).

## Team

| Roll No. | Name |
|---|---|
| 20251651008 | Aditi Garg |
| 20251651084 | Shivam Kumar Soni |
| 20251651064 | Neha Nupur |

## Demo

- Demonstration video: *Paste Google Drive link here*
- Screenshots:
  - [GET without token – 401 Unauthorized](screenshots/1-no-token.png)
  - [Restaurant login – JWT received](screenshots/2-restaurant-login.png)
  - [GET with token – 200 OK](screenshots/3-get-with-token.png)
  - [Restaurant adds item – 201 Created](screenshots/4-restaurant-post.png)
  - [Customer login](screenshots/5-customer-login.png)
  - [Customer POST – 403 Forbidden](screenshots/6-customer-post.png)
- Raw `curl` output: [screenshots/curl-output.txt](screenshots/curl-output.txt)

## Files

```text
server.js          Express REST API (authentication, authorization,
                   routes, validation and in-memory menu data)
package.json       Project dependencies
package-lock.json Dependency lock file
public/            Static frontend files (if used)
screenshots/       API testing screenshots and curl output
```

## Features

- REST API using Node.js and Express.js.
- JWT-based user authentication.
- Password hashing and verification using bcryptjs.
- Role-based authorization.
- Two user roles: Customer and Restaurant.
- Protected GET and POST routes.
- Input validation for new menu items.
- Proper HTTP status code handling.
- In-memory menu storage (no database required).

## Answers

### 1. How is user authentication implemented?

Authentication is implemented using **JSON Web Tokens (JWT)** and `bcryptjs`.

- Two demo users are created when the server starts.
- User passwords are stored as bcrypt hashes instead of plain text.
- The user sends their email and password to the `/login` endpoint.
- The server checks the password using `bcrypt.compareSync()`.
- If the credentials are correct, the server generates a JWT using `jwt.sign()`.
- The token contains the user's ID (`sub`) and role.
- The token expires after one hour.

### 2. What is the purpose of the authentication middleware?

The `auth` middleware verifies the JWT token before allowing access to protected routes.

- It reads the token from the `Authorization` header.
- It verifies the token using `jwt.verify()`.
- If the token is valid, the decoded user information is stored in `req.user`.
- If the token is missing, invalid or expired, it returns `401 Unauthorized`.

Example header:

```text
Authorization: Bearer <token>
```

### 3. How is role-based authorization implemented?

Role-based authorization is implemented using the `requireRole()` middleware.

There are two roles:

- **Customer:** Can view the menu items.
- **Restaurant:** Can view and add menu items.

The middleware checks the role stored inside the verified JWT.

If the user's role is not allowed, the server returns `403 Forbidden`.

For example:

```javascript
app.get('/items', auth, (req, res) => {
    res.json(items);
});

app.post('/items', auth, requireRole('restaurant'), (req, res) => {
    // Add new menu item
});
```

### 4. What is the difference between 401 and 403?

| Status Code | Meaning | Example |
|---|---|---|
| 401 Unauthorized | User is not authenticated | Accessing `/items` without a token |
| 403 Forbidden | User is authenticated but does not have permission | Customer trying to add a dish |

**401 means:** The server cannot identify the user.

**403 means:** The server knows the user, but the user is not allowed to perform that operation.

### 5. Which API routes are protected?

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/login` | Verify credentials and generate JWT | Public |
| GET | `/items` | Get all menu items | Authenticated users |
| GET | `/items/:id` | Get a particular menu item | Authenticated users |
| POST | `/items` | Add a new menu item | Restaurant only |

### 6. How are passwords secured?

Passwords are hashed using the `bcryptjs` package.

- `bcrypt.hashSync()` generates a password hash.
- `bcrypt.compareSync()` checks the entered password against the stored hash.
- Passwords are never stored as plain text in the user objects.

The JWT secret is used to sign and verify tokens.

## Demo Login Credentials

| Role | Email | Password |
|---|---|---|
| Customer | shivam@campus.edu | customer123 |
| Restaurant | mealhub@campus.edu | resto123 |

These are demo credentials created for practical testing.

## Quick Test

The following commands can be executed using Windows Command Prompt (CMD).

### 1. Start the server

```bash
node server.js
```

Expected output:

```text
Catalogue on http://localhost:3000
```

### 2. GET items without a token (401)

```cmd
curl -i http://localhost:3000/items
```

Expected response:

```json
{"error":"invalid or missing token"}
```

### 3. Login as Restaurant

```cmd
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d "{\"email\":\"mealhub@campus.edu\",\"password\":\"resto123\"}"
```

Copy the JWT token returned by the server.

### 4. Set the Restaurant Token

```cmd
set "TOKEN=PASTE_YOUR_RESTAURANT_TOKEN_HERE"
```

### 5. GET items with a valid token (200)

```cmd
curl -i http://localhost:3000/items -H "Authorization: Bearer %TOKEN%"
```

The server returns the menu items after successful authentication.

### 6. Add a new item as Restaurant (201)

```cmd
curl -i -X POST http://localhost:3000/items -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"name\":\"Masala Dosa\",\"price\":60}"
```

Expected response:

```json
{
    "id": 5,
    "name": "Masala Dosa",
    "price": 60
}
```

### 7. Login as Customer

```cmd
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d "{\"email\":\"shivam@campus.edu\",\"password\":\"customer123\"}"
```

Copy the new customer token.

### 8. Set the Customer Token

```cmd
set "TOKEN=PASTE_YOUR_CUSTOMER_TOKEN_HERE"
```

### 9. Try adding an item as Customer (403)

```cmd
curl -i -X POST http://localhost:3000/items -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"name\":\"Hack Burger\",\"price\":99}"
```

Expected response:

```json
{
    "error": "forbidden"
}
```

The request is rejected because customers are not allowed to add menu items.

## Testing Results

| Test Case | Expected Result | Actual Result |
|---|---|---|
| GET without token | 401 Unauthorized | 401 Unauthorized |
| Restaurant login | JWT token | Successful |
| GET with restaurant token | 200 OK | 200 OK |
| POST with restaurant token | 201 Created | 201 Created |
| Customer login | JWT token | Successful |
| POST with customer token | 403 Forbidden | 403 Forbidden |

All the above authentication and authorization tests were performed successfully.

## Technologies Used

- Node.js
- Express.js
- JavaScript
- JSON Web Token (`jsonwebtoken`)
- bcryptjs
- HTML and CSS (if frontend is included)

## Important Notes

- This assignment uses in-memory data storage, so menu changes are lost when the server restarts.
- No MySQL database is required.
- The demo users are created directly in `server.js`.
- JWT tokens expire after one hour.
- The restaurant role is required to add new menu items.
- The secret key used in this assignment is for demonstration only. In a real application, it should be stored in an environment variable.
- In production, API requests should be served over HTTPS.

## Learning Outcomes

Through this assignment, we learned:

- How to implement JWT authentication in Express.js.
- How to hash and verify passwords using bcryptjs.
- How to create authentication middleware.
- How to implement role-based authorization.
- How to protect REST API endpoints.
- How to differentiate between HTTP 401 and 403 responses.
- How to test secured APIs using curl.

---

**Course:** CS543 – Web Services  
**Assignment:** 9 – API Authentication and Authorization  
**Faculty:** Dr. Pramit Mazumdar  
**Institute:** IIIT Vadodara

*Developed as part of our Web Services coursework.*