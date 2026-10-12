# Simpan API

REST API for tracking food items and their expiry dates. Users sign up, verify their email, and manage their own food inventory. Built with Node.js, Express, and MongoDB.

![CI](https://github.com/alinabilali/simpan-api/actions/workflows/ci.yml/badge.svg)

## Features

- Signup with email verification (hashed, expiring, single-use tokens)
- Login with a JWT access token and an httpOnly refresh-token cookie
- Password reset by email (hashed, expiring, single-use tokens)
- Role-based access control (`user` and `admin`)
- Per-user data ownership: users can only read and change their own food items
- Rate limiting on login
- Automated tests and CI

## Tech stack

- Node.js, Express
- MongoDB, Mongoose
- JWT, bcrypt, Nodemailer
- Jest, Supertest, mongodb-memory-server
- ESLint
- Docker, Docker Compose
- GitHub Actions

## Getting started

### 1. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable               | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `DATABASE_URI`         | MongoDB connection string                               |
| `ACCESS_TOKEN_SECRET`  | Signs access tokens                                     |
| `REFRESH_TOKEN_SECRET` | Signs refresh tokens                                    |
| `CLIENT_URL`           | Frontend base URL, used in verification and reset links |
| `EMAIL_USER`           | Gmail address used to send email                        |
| `EMAIL_PASS`           | Gmail App Password                                      |

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Never commit `.env`.

### 2. Run it

With Docker:

```bash
docker compose up --build
```

The API is at `http://localhost:5001`.

Without Docker:

```bash
npm install
npm run dev
```

The API is at `http://localhost:3500`.

### 3. Create the first admin

There is no endpoint for promoting users, on purpose. Sign up, verify the account, then set the role directly in the database:

```js
db.users.updateOne({ username: 'yourname' }, { $set: { role: 'admin' } });
```

## Tests

```bash
npm test
```

Tests use an in-memory MongoDB, fake secrets, and a mocked mail transport, so no `.env`, database, or email account is needed. The first run downloads a MongoDB binary and can take a few minutes. CI runs the same tests on every push and pull request.

## API

### Auth

| Method | Route                          | Description                                     |
| ------ | ------------------------------ | ----------------------------------------------- |
| POST   | `/auth/signup`                 | Create an account and send a verification email |
| GET    | `/auth/verify-email?token=...` | Verify an email address                         |
| POST   | `/auth/resend-verification`    | Send a new verification email                   |
| POST   | `/auth`                        | Log in (rate limited, verified accounts only)   |
| GET    | `/auth/refresh`                | Get a new access token from the refresh cookie  |
| POST   | `/auth/logout`                 | Clear the refresh cookie                        |
| POST   | `/auth/forgot-password`        | Email a password reset link                     |
| POST   | `/auth/reset-password`         | Set a new password using the emailed token      |

### Users (requires `Authorization: Bearer <token>`)

| Method | Route    | Description    | Access         |
| ------ | -------- | -------------- | -------------- |
| GET    | `/users` | List all users | Admin only     |
| PATCH  | `/users` | Update a user  | Owner or admin |
| DELETE | `/users` | Delete a user  | Owner or admin |

### Food (requires `Authorization: Bearer <token>`)

| Method | Route                 | Description                   |
| ------ | --------------------- | ----------------------------- |
| GET    | `/food`               | List your food items          |
| POST   | `/food`               | Add a food item               |
| PATCH  | `/food`               | Update one of your food items |
| DELETE | `/food`               | Delete one of your food items |
| GET    | `/food/expiredFood`   | List your expired items       |
| DELETE | `/food/deleteAllFood` | Delete your expired items     |

## Design decisions

- **Ownership comes from the token, never the request body.** An early version trusted a `user` field sent by the client, so any logged-in user could edit anyone's data. Tests exposed it, and every food query is now scoped to the verified user.
- **Reset and verification tokens are random, hashed in the database, expiring, and single-use.** A database leak doesn't expose usable links.
- **Forgot-password and resend-verification give the same response whether or not the account exists**, so they can't be used to find registered emails.
- **Input types are checked** (a JSON object where a string is expected is rejected), which closes off NoSQL operator injection.
- **A password reset invalidates refresh tokens issued before it.**

## Known gaps

- Email sending is covered by tests with a mocked transport. It has not been verified end to end against a live inbox, because the Gmail account used for testing was locked by Google.
- If the verification email can't be sent, signup removes the new user and returns a 500.
- Access tokens last 7 days, the same as refresh tokens. Shorter-lived access tokens are the next change.
- Logout only clears the cookie. A stolen refresh token stays valid until it expires, except after a password reset. Server-side revocation is not implemented.
- Only login is rate limited. Signup, forgot-password, and resend-verification are not.
