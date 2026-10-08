# Simpan API

A backend API for tracking food items and their expiry dates, built with Express and MongoDB. Users can log in, manage their own food inventory, and get notified about what's expiring soon.

![CI](https://github.com/alinabilali/simpan-api/actions/workflows/ci.yml/badge.svg)

## Tech stack

- Node.js / Express
- MongoDB with Mongoose
- JWT authentication (access + refresh tokens) with role-based access control
- Jest + Supertest for testing, with an in-memory MongoDB for isolated test runs
- Docker + Docker Compose for local development
- GitHub Actions for CI

## Running locally

### With Docker (recommended)

```bash
docker compose up --build
```

The API will be available at `http://localhost:5001`.

### Without Docker

```bash
npm install
npm run dev
```

You'll need a `.env` file — see `.env.example` for the required variables (database connection string, JWT secrets).

## Running tests

```bash
npm test
```

Tests use an in-memory MongoDB and fake secrets (see `tests/setEnv.js`), so no real database or `.env` is needed to run them.

## Authentication & roles

- Signup and login issue a short-lived access token and a long-lived refresh token (stored as an httpOnly cookie)
- Every user has a `role` of `user` or `admin` (defaults to `user`)
- Regular users can only view, update, or delete their own account and their own food items
- Admins can view all users

There's currently no endpoint to promote a user to admin — the first admin is set directly in the database. This is a deliberate simplification for a small project.

## Main endpoints

| Method | Route                 | Description                    | Access                        |
| ------ | --------------------- | ------------------------------ | ----------------------------- |
| POST   | `/auth/signup`        | Create an account              | Public                        |
| POST   | `/auth`               | Log in                         | Public                        |
| GET    | `/auth/refresh`       | Get a new access token         | Public (needs refresh cookie) |
| POST   | `/auth/logout`        | Clear the refresh cookie       | Public                        |
| GET    | `/users`              | List all users                 | Admin only                    |
| PATCH  | `/users`              | Update your own profile        | Authenticated                 |
| DELETE | `/users`              | Delete your own account        | Authenticated                 |
| GET    | `/food`               | List your food items           | Authenticated                 |
| POST   | `/food`               | Add a food item                | Authenticated                 |
| PATCH  | `/food`               | Update one of your food items  | Authenticated                 |
| DELETE | `/food`               | Delete one of your food items  | Authenticated                 |
| GET    | `/food/expiredFood`   | List your expired food items   | Authenticated                 |
| DELETE | `/food/deleteAllFood` | Delete your expired food items | Authenticated                 |

## Known gaps

- Email verification (`verified` field on the User model) exists in the schema but isn't enforced yet
- Password reset emails (`forgotPassword`) are fully implemented and covered by tests (with a mocked mail transport), but live sending is currently blocked — the Gmail account used for testing got temporarily locked by Google while setting up App Passwords. The integration itself (nodemailer, error handling, no email-enumeration leak) is complete and ready once a working mail account is configured.
