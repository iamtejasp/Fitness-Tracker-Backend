# Fitness Tracker Backend

**Project**

- **Description**: Production-ready NestJS backend for a mobile fitness tracker, implementing JWT auth, MongoDB persistence (Mongoose), workout CRUD, user profiles, and Gemini-powered coaching.

**Features**

- **Authentication**: JWT-based sign-up, sign-in, and protected routes.
- **Persistence**: Mongoose schemas for users and workouts with ownership enforcement.
- **Workouts**: Create, read, update, delete, pagination, recent history, and stats.
- **AI Coaching**: Google Gemini AI Studio coaching endpoint and SSE-compatible streaming support.
- **Validation & Errors**: DTO validation via `class-validator` and global error handling.

**Prerequisites**

- **Node.js**: v20+ recommended. The Google GenAI SDK requires Node 20 or newer.
- **MongoDB**: Local or remote instance reachable via `MONGO_URI`.

**Install**

```bash
npm install
```

**Required Dependencies**

- **Runtime**: `@nestjs/config`, `@nestjs/mongoose`, `mongoose`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `class-validator`, `class-transformer`, `@google/genai`, `openai`
- **Dev**: `@types/bcrypt`, `@types/passport-jwt`

You can install them with:

```bash
npm install @nestjs/config @nestjs/mongoose mongoose @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer @google/genai openai
npm install -D @types/bcrypt @types/passport-jwt
```

**Environment**

- **Create**: copy `.env.example` → `.env` and fill values.
- **Important vars**:
  - `PORT` — server port (default: `3000`)
  - `MONGO_URI` — MongoDB connection string
  - `JWT_SECRET` — secret for signing JWTs
  - `JWT_EXPIRES_IN` — token expiry (e.g., `7d`)
  - `GEMINI_API_KEY` — Google AI Studio API key for Gemini
  - `GEMINI_MODEL` — model to use (default: `gemini-2.5-flash`)
  - `OPENAI_API_KEY` — optional backup key for the preserved OpenAI service
  - `OPENAI_MODEL` — optional backup OpenAI model (e.g., `gpt-4.1-mini`)

**Run**

```bash
# development
npm run start

# watch mode
npm run start:dev

# production
npm run start:prod
```

**Build & Test**

```bash
npm run build
npm run test
npm run test:e2e
```

**Free Deployment: Render + MongoDB Atlas**

For a free demo deployment, use:

- **Backend host**: Render Free Web Service
- **Database**: MongoDB Atlas Free Cluster (`M0`)

Render free web services support Node.js/NestJS and provide a public `onrender.com` URL, but they sleep after 15 minutes of inactivity and can take about a minute to wake up. This is acceptable for portfolio/demo usage, not production traffic.

MongoDB Atlas free clusters never expire, but they are intended for development/small demos and have shared-resource limits.

This backend is Render-ready:

- The server binds to `0.0.0.0`.
- The app reads Render's `PORT` environment variable.
- Public health check: `GET /api/v1/health`.

Required Render environment variables:

```bash
MONGO_URI=<mongodb-connection-string>
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=<google-ai-studio-key>
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGINS=<comma-separated-mobile-or-web-origins>
NODE_ENV=production
```

Render settings:

- **Service type**: Web Service
- **Root directory**: `backend` if deploying from the full monorepo
- **Build command**: `npm ci --include=dev && npm run build`
- **Start command**: `npm run start:prod`
- **Health check path**: `/api/v1/health`
- **Instance type**: Free

Use `npm ci --include=dev` because NestJS builds with `@nestjs/cli`, which is a dev dependency. If Render installs production-only dependencies during build, `nest build` fails with `sh: 1: nest: not found`.

After deploy, verify:

```bash
curl https://<your-render-service>.onrender.com/api/v1/health
```

**API Overview (Highlights)**

- **Auth**: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (protected)
- **Users**: `GET /users/profile`, `PATCH /users/profile` (protected)
- **Workouts**: `POST /workouts`, `GET /workouts`, `GET /workouts/:id`, `PATCH /workouts/:id`, `DELETE /workouts/:id`, `GET /workouts/last-30-days`, `GET /workouts/stats` (all protected)
- **AI**: `POST /ai/coach`, `POST /ai/coach/stream` (protected)

Controllers are intentionally thin — validation and auth live in DTOs, guards, and services.

**Implementation Plan**

- The full, detailed implementation plan is available in: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- Key milestones: setup/config, users, auth, workouts, AI, auth sweep, testing.

**Suggested Build Order**

- **1**: Setup and global config
- **2**: Users module
- **3**: Auth module + guards
- **4**: Profile endpoints
- **5**: Workout CRUD
- **6**: Workout stats + recent history
- **7**: AI coaching (non-streaming)
- **8**: AI streaming
- **9**: Final auth sweep and verification

**Notes & Conventions**

- **Never** return plaintext passwords; only hashed passwords are stored.
- **Ownership**: all workout queries are filtered by authenticated user ID; do not accept `userId` from the client.
- **Validation**: use `class-validator` decorators on DTOs and enable global `ValidationPipe`.
- **Gemini**: prompt-building is isolated in `AiService`; streaming uses SSE-compatible chunking. The previous OpenAI implementation is preserved in `src/ai/ai.service.openai.backup.ts`.

**Next Steps**

- Review the `IMPLEMENTATION_PLAN.md` and let me know if you want me to:
  - scaffold missing modules and DTOs,
  - implement a specific chunk (users/auth/workouts/ai), or
  - run the project locally and verify startup.

**License**

- See project root for license information.
