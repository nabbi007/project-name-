# AgroVoice Backend

Central API for AgroVoice, a voice-first agricultural marketplace. Field agents register farmers, capture produce details by voice, and the backend handles transcription, listing extraction, image analysis, and a buyer marketplace. The React frontend never calls the Snwolley AI APIs directly; all AI requests pass through this backend.

## Tech stack

- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- JWT auth + bcrypt
- Zod validation
- Helmet, CORS, express-rate-limit
- Multer (uploads), Axios (Snwolley client)

## Getting started

```bash
cd server
npm install
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET
npm run prisma:migrate -- --name init
npm run seed
npm run dev
```

Server runs on `http://localhost:5000`. Health check: `GET /api/health`.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Generate Prisma client + compile TypeScript |
| `npm start` | Run compiled server from `dist/` |
| `npm run prisma:migrate` | Create/apply a migration |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run seed` | Seed admin + test users |

## Status

- Phase 1 (foundation) and Phase 2 (auth + roles) implemented.
- Full Prisma schema defined for all phases.
- Phases 3-11 are scaffolded as placeholders.

## Auth endpoints

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public (BUYER only) |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| POST | `/api/auth/logout` | Authenticated |
| POST | `/api/admin/agents` | ADMIN only |

## Seeded accounts

After `npm run seed`:

- Admin: `admin@agrovoice.test` / `Admin123!`
- Field agent: `agent@agrovoice.test` / `Agent123!`
- Buyer: `buyer@agrovoice.test` / `Buyer123!`

## Environment

See `.env.example`. Never commit `.env`. Never expose Snwolley keys to the frontend.
