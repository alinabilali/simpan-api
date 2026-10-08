# Simpan API

A backend API for tracking food items and their expiry dates, built with Express and MongoDB. Users can log in, manage their own food inventory, and get notified about what's expiring soon.

![CI](https://github.com/alinabilali/simpan-api/actions/workflows/ci.yml/badge.svg)

## Tech stack

- Node.js / Express
- MongoDB (Mongoose)
- JWT authentication with role-based access control
- Jest + Supertest for testing
- Docker + GitHub Actions CI

## Running locally

```bash
npm install
docker compose up --build
```

## Tests

```bash
npm test
```
