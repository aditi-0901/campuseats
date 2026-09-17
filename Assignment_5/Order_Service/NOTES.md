# Resource Table

| Method | URL | Does | Success | Failure |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/orders` | Place a new order | 201 | 400, 422, 503 |
| GET | `/orders/{id}` | Read a single order | 200 | 404 |
| GET | `/orders?student={id}` | List a student's orders | 200 | 400 |
| POST | `/orders/{id}/cancel` | Cancel an order | 202 | 404, 409 |

# A5: Justification
The `cancelOrder` operation mapped least comfortably onto a standard REST resource[cite: 4]. I rejected mapping it to `DELETE /orders/{id}` because an order is a financial record that should not be deleted from the database. Instead, I resolved it by modelling the cancellation as a state-changing sub-resource (`POST /orders/{id}/cancel`), explicitly capturing the intent to change the status without destroying the record.

# D3: Fallback Justification
If the Payments dependency is unreachable, the Orders service chooses to fail with a 503 rather than degrade. Degrading (e.g., placing the order anyway without charging) would be wrong because CampusEats requires payment before dispatch; allowing unpaid orders violates the business constraints of the system.

# Answers
1. My WSDL was [Count] lines, while the `openapi.yaml` is [Count] lines. The WSDL required the `<binding>` element and the `<port>` element, neither of which are needed in OpenAPI because HTTP handles the protocol and the URL acts as the address.
2. The WSDL declared `<soap:Fault name="invalidAmount"/>`. This was replaced by returning a 400 status code with a problem JSON body containing `{"type": "/errors/invalid-request"}`. Returning a fault inside a 200 OK is problematic because intermediate network proxies and caches read the 200 OK and mistakenly assume the request succeeded.
3. The "bind" action disappeared. The container registers itself on boot (publish), and the application resolves the DNS name dynamically (find), but because the communication is standard HTTP, there is nothing left to "bind".
4. The `validate(body)` function now carries the responsibility of enforcing the schema before logic runs. If I had not written it, passing a string like `"two"` instead of an integer for `qty` would bypass validation and crash the application with a `500 Internal Server Error` during the price calculation.
5. I would choose SOAP for the Payments component if strict transactional guarantees across multiple distinct databases were required. SOAP provides WS-AtomicTransaction, which can guarantee a distributed rollback if one part of a multi-system transaction fails, a guarantee REST lacks without building complex custom sagas.

Assignment 5


# Part A — Methods & Message

## A1: CampusEats Method Map

| Action | HTTP Method | URL |
|---|---|---|
| Place a new order | POST | `/orders` |
| List student orders | GET | `/orders?student={id}` |
| Read a single order | GET | `/orders/{id}` |
| Cancel an order | POST | `/orders/{id}/cancel` |

The API uses HTTP methods according to the resource operation:
- GET = read
- POST = create
- POST sub-resource = non-CRUD state-changing action

## A2: Non-CRUD Action

Order cancellation is not modeled as `POST /cancelOrder`.

Instead, it is represented as:

POST `/orders/{id}/cancel`

This keeps the URL resource-oriented while clearly representing cancellation as a state-changing action.

## A3: Safe and Idempotent

| Endpoint | Safe | Idempotent |
|---|---|---|
| GET `/orders` | Yes | Yes |
| GET `/orders/{id}` | Yes | Yes |
| POST `/orders` | No | No naturally; Idempotency-Key makes retries safe |
| POST `/orders/{id}/cancel` | No | Not naturally |

GET operations are read-only and never modify server state.

POST `/orders` creates a new order, so repeating the request can create multiple orders. The Idempotency-Key mechanism prevents duplicate creation when the same key is retried.

The cancel operation changes the order state from `placed` to `cancelled`, so it is not a safe operation.

## A4: List, Filter, Sort and Paginate

The order list endpoint remains a pure GET/read operation.

GET `/orders`

Supported query parameters:

- `student` — filter orders by student ID
- `page` — page number, default `1`
- `limit` — number of results per page, default `10`
- `sort` — `createdAt` or `id`, default `createdAt`
- `order` — `asc` or `desc`, default `asc`

Example:

GET `/orders?student=101&page=1&limit=10&sort=createdAt&order=desc`

Invalid query parameters return `400 Bad Request`.

The endpoint does not modify server state.

## A5: OPTIONS and Allow

The Orders service implements:

OPTIONS `/orders`

The response is:

HTTP/1.1 204 No Content
Allow: GET, POST, OPTIONS

This informs the client which HTTP methods are supported for the `/orders` resource.

### X-HTTP-Method-Override

X-HTTP-Method-Override is documented as a fallback for constrained clients that cannot directly send methods such as PUT or DELETE. The current Orders API does not depend on this mechanism because its existing endpoints do not require PUT or DELETE.