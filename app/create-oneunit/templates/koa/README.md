# koa + @oneunit/core

Scaffolded with [`create-oneunit`](https://www.npmjs.com/package/create-oneunit).

## Getting started

```bash
npm install
npm run dev
```

The server runs on `http://localhost:3000`.

## Project structure

```
src/
  index.ts    # Application entry point
```

## Scripts

- `npm run dev` — Start with tsx watch
- `npm run build` — Compile TypeScript to dist/
- `npm run start` — Run compiled output

## Available via @oneunit/core

- `createApp()` — Unified app facade
- Security middleware: `cors()`, `helmet()`, `csrf()`, `compression()`, `sanitize()`, `rateLimit()`
- Cookies: `app.cookies(req, res)`
- Responses: `app.response(req, res)`
- Health: `app.health()`
