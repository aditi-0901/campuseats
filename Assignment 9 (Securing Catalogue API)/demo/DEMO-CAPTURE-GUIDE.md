# Assignment 9 — Demo recording and screenshot guide

Use the VS Code PowerShell terminal so each command and response can be visible together. Capture genuine results from your own running service; do not fabricate screenshots or recordings.

## Part A — Capture the Assignment 8 baseline (before)

1. Extract your original `Assignment 8 (Catelogue).zip` into a separate folder. Keep this separate from the Assignment 9 folder.
2. Open the extracted Assignment 8 folder in VS Code.
3. Run `npm install`, then `node server.js`.
4. Open a second terminal and run:

   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/items"
   ```

5. Capture the original public catalogue response as `before-01-public-catalogue.png`.
6. Record a 10–15 second clip showing the original service returning the catalogue without login. Save it as `before-assignment-8.mp4`.
7. Stop the old server with `Ctrl+C`.

This is only the before/baseline. Do not submit the unsecured Assignment 8 code as the final Assignment 9 implementation.

## Part B — Prepare Assignment 9

1. Open the `Assignment 9 - Securing Catalogue API` folder in VS Code.
2. Run:

   ```powershell
   npm install
   ```

3. Copy `.env.example` to a new file named `.env`.
4. Generate a random secret:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Put the generated value in `.env`:

   ```text
   JWT_SECRET=paste_the_generated_random_value_here
   PORT=3000
   ```

6. Save `.env`. Do not show or share this file or its secret in screenshots/video.
7. Start the API:

   ```powershell
   npm start
   ```

8. Keep this terminal running. Use a second VS Code terminal for the requests below.

## Part C — Capture the five required cases in order

In the second PowerShell terminal, initialize variables:

```powershell
$base = "http://localhost:3000"
$customerToken = $null
$restaurantToken = $null
```

### Case 1 — Request without a token returns 401

```powershell
try {
    Invoke-RestMethod -Uri "$base/items" -Method GET
} catch {
    $_.Exception.Response.StatusCode.value__
    $_.ErrorDetails.Message
}
```

Expected: `401` and an error about the missing or invalid authorization token. Capture the command and response as `01-401-no-token.png`.

### Case 2 — Successful login returns a JWT

```powershell
$login = Invoke-RestMethod `
    -Uri "$base/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body (@{ username = "restaurant"; password = "restaurant123" } | ConvertTo-Json)

$restaurantToken = $login.token
$login
```

Expected: `login successful`, role `restaurant`, token type `Bearer`, expiry `1h`, and a JWT string. Capture the response as `02-login-token.png`. The token may be visible for this private course submission; never show the JWT secret.

### Case 3 — Authenticated read returns 200

```powershell
Invoke-WebRequest `
    -Uri "$base/items" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $restaurantToken" } | ForEach-Object {
        $_.StatusCode
        $_.Content
    }
```

Expected: `200` and the four seeded catalogue items. Capture as `03-200-authenticated-read.png`.

### Case 4 — Privileged restaurant role creates an item and receives 201

Use `Invoke-WebRequest` so the HTTP status is explicitly visible:

```powershell
$response = Invoke-WebRequest `
    -Uri "$base/items" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $restaurantToken" } `
    -ContentType "application/json" `
    -Body (@{ name = "Assignment 9 Demo Special"; price = 125; available = $true } | ConvertTo-Json)

$response.StatusCode
$response.StatusDescription
$response.Content
```

Expected: `201`, `Created`, and the newly created item (normally ID `5` on a fresh server). Capture as `04-201-restaurant-create.png`.

### Case 5 — Customer role is authenticated but receives 403 on write

First log in as customer:

```powershell
$customerLogin = Invoke-RestMethod `
    -Uri "$base/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body (@{ username = "customer"; password = "customer123" } | ConvertTo-Json)

$customerToken = $customerLogin.token
$customerLogin.user
```

Then attempt the write:

```powershell
try {
    Invoke-WebRequest `
        -Uri "$base/items" `
        -Method POST `
        -Headers @{ Authorization = "Bearer $customerToken" } `
        -ContentType "application/json" `
        -Body (@{ name = "Customer Must Not Add"; price = 50; available = $true } | ConvertTo-Json)
} catch {
    $_.Exception.Response.StatusCode.value__
    $_.ErrorDetails.Message
}
```

Expected: `403` and `forbidden: insufficient role`. It is `403`, not `401`, because the customer's JWT is valid and authentication succeeded; the role check denies the write. Capture as `05-403-customer-write-denied.png`.

## Part D — Record the after video

1. Keep the secured API running.
2. Start Windows Snipping Tool screen recording or another screen recorder.
3. Record the terminal while executing the five cases above in order.
4. Show the restaurant login, the returned role/token, authenticated read, successful restaurant create, and customer write denial.
5. Do not show `.env` or expose the JWT secret.
6. Stop recording and save as `after-assignment-9-demo.mp4` (about 1–3 minutes).

You can also demonstrate the frontend at `http://localhost:3000`: log in as `customer` to show read-only access, log out, then log in as `restaurant` to show the add-item form. Use PowerShell for the exact HTTP status-code evidence because the frontend does not display all status codes.

## Part E — Upload evidence to Google Drive

Create a Google Drive folder named `CS543 Assignment 9 - Securing the API` and put these files in it:

```text
before-01-public-catalogue.png
before-assignment-8.mp4
01-401-no-token.png
02-login-token.png
03-200-authenticated-read.png
04-201-restaurant-create.png
05-403-customer-write-denied.png
after-assignment-9-demo.mp4
```

Upload the folder, copy its share link, and paste it and the direct video link into the Demo section of the root `README.md`. Confirm that the evaluator has permission to view the files.

## Final checks

- Run `npm test` and check that every test passes.
- Run `git status` and confirm `.env` is not listed for commit.
- Commit `.env.example`, not `.env`.
- Do not fabricate or pre-fill screenshots/video. Capture them from the running service so they show real responses from your machine.
