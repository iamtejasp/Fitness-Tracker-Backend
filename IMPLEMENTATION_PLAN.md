# Fitness Tracker Backend Implementation Plan

This plan breaks the NestJS backend into safe build chunks so each module can be implemented, tested, and connected without mixing responsibilities.

## Target Backend

Build a production-ready NestJS API for a mobile fitness tracker with:

- JWT authentication
- MongoDB persistence through Mongoose
- User profile management
- Workout CRUD, pagination, recent history, and stats
- OpenAI-powered coaching
- Streaming AI coaching response
- DTO validation and global error handling

## Required Dependencies

Install these before implementation:

```bash
npm install @nestjs/config @nestjs/mongoose mongoose @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer openai
npm install -D @types/bcrypt @types/passport-jwt
```

## Environment Variables

Create `.env` from `.env.example` during setup:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/fitness-tracker
JWT_SECRET=replace-with-secure-secret
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=replace-with-openai-key
OPENAI_MODEL=gpt-4.1-mini
```

## Final Folder Structure

```text
src/
├── ai/
│   ├── dto/
│   ├── ai.controller.ts
│   ├── ai.module.ts
│   └── ai.service.ts
├── auth/
│   ├── dto/
│   ├── strategies/
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   └── auth.service.ts
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   └── types/
├── config/
│   └── configuration.ts
├── users/
│   ├── dto/
│   ├── schemas/
│   ├── users.controller.ts
│   ├── users.module.ts
│   └── users.service.ts
├── workouts/
│   ├── dto/
│   ├── schemas/
│   ├── workouts.controller.ts
│   ├── workouts.module.ts
│   └── workouts.service.ts
├── app.module.ts
└── main.ts
```

## Chunk 1: Setup And Global Config

### Goal

Prepare the app foundation before feature modules are added.

### Work

- Install required dependencies.
- Add `.env.example`.
- Add `src/config/configuration.ts`.
- Configure `ConfigModule.forRoot`.
- Configure `MongooseModule.forRootAsync`.
- Enable global `ValidationPipe` in `main.ts`.
- Enable global error handling interceptor.
- Remove or simplify starter controller/service if no longer needed.

### Files

- `package.json`
- `.env.example`
- `src/config/configuration.ts`
- `src/app.module.ts`
- `src/main.ts`
- `src/common/interceptors/error-handling.interceptor.ts`

### Acceptance Checks

- `npm run build` passes.
- App boots with valid `MONGO_URI`.
- Invalid DTO payloads return proper validation errors.

## Chunk 2: Users Module

### Goal

Create the user persistence layer and profile endpoints that auth and workouts depend on.

### Work

- Create `User` Mongoose schema.
- Fields: `name`, `email`, `password`, timestamps.
- Add unique email index.
- Exclude password from API responses.
- Create `UsersService`.
- Create `UsersController`.
- Add profile routes:
  - `GET /users/profile`
  - `PATCH /users/profile`
- Add update profile DTO.

### Files

- `src/users/schemas/user.schema.ts`
- `src/users/dto/update-profile.dto.ts`
- `src/users/users.service.ts`
- `src/users/users.controller.ts`
- `src/users/users.module.ts`

### Acceptance Checks

- User lookup by ID works.
- User lookup by email works.
- Profile update does not allow password changes.
- Password is never returned in profile responses.

## Chunk 3: Auth Module

### Goal

Implement complete JWT authentication.

### Work

- Add DTOs:
  - `RegisterDto`
  - `LoginDto`
- Hash passwords with bcrypt.
- Register new users.
- Reject duplicate emails.
- Validate login credentials.
- Generate JWT containing `sub` user ID and email.
- Add `JwtStrategy`.
- Add reusable `JwtAuthGuard`.
- Add reusable `CurrentUser` decorator.
- Add auth routes:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`

### Files

- `src/auth/dto/register.dto.ts`
- `src/auth/dto/login.dto.ts`
- `src/auth/strategies/jwt.strategy.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth.module.ts`
- `src/common/guards/jwt-auth.guard.ts`
- `src/common/decorators/current-user.decorator.ts`
- `src/common/types/authenticated-request.type.ts`

### Acceptance Checks

- Register returns user data and access token.
- Login returns user data and access token.
- Wrong password returns `401`.
- Duplicate email returns `409`.
- Protected routes reject missing or invalid JWT.
- `GET /auth/me` returns the authenticated user.

## Chunk 4: Workouts Module

### Goal

Implement user-scoped workout tracking and dashboard stats.

### Work

- Create `Workout` Mongoose schema.
- Add nested exercise schema:
  - `name`
  - `sets`
  - `reps`
  - `weight`
- Add DTOs:
  - `CreateWorkoutDto`
  - `UpdateWorkoutDto`
  - `ExerciseDto`
  - `WorkoutQueryDto`
- Add routes:
  - `POST /workouts`
  - `GET /workouts?page=1&limit=10`
  - `GET /workouts/last-30-days`
  - `GET /workouts/stats`
  - `GET /workouts/:id`
  - `PATCH /workouts/:id`
  - `DELETE /workouts/:id`
- Ensure all queries are filtered by logged-in user.
- Add pagination metadata.
- Use efficient MongoDB queries and aggregation for stats.

### Files

- `src/workouts/schemas/workout.schema.ts`
- `src/workouts/dto/exercise.dto.ts`
- `src/workouts/dto/create-workout.dto.ts`
- `src/workouts/dto/update-workout.dto.ts`
- `src/workouts/dto/workout-query.dto.ts`
- `src/workouts/workouts.service.ts`
- `src/workouts/workouts.controller.ts`
- `src/workouts/workouts.module.ts`

### Acceptance Checks

- Users can only access their own workouts.
- Pagination returns `data`, `page`, `limit`, `total`, and `totalPages`.
- `last-30-days` returns only recent workouts for the logged-in user.
- Stats return `totalWorkouts`, `workoutsThisWeek`, and `mostFrequentExercise`.
- Invalid workout IDs return `404` or `400` appropriately.

## Chunk 5: AI Module

### Goal

Generate concise coaching advice using the user's last 30 days of workout data.

### Work

- Add `CoachMessageDto`.
- Inject `WorkoutsService`.
- Fetch last 30 days of workouts before calling OpenAI.
- Format structured workout summary.
- Build prompt with rules:
  - detect plateaus
  - suggest progressive overload
  - give actionable advice
  - keep response concise, 3-5 lines
- Add non-streaming route:
  - `POST /ai/coach`
- Add streaming route:
  - `POST /ai/coach/stream`
- Use official OpenAI SDK.
- Handle OpenAI errors gracefully.
- Stream chunks using SSE-compatible response headers.

### Files

- `src/ai/dto/coach-message.dto.ts`
- `src/ai/ai.service.ts`
- `src/ai/ai.controller.ts`
- `src/ai/ai.module.ts`

### Acceptance Checks

- AI response uses authenticated user's real workout history.
- Empty workout history is handled gracefully.
- OpenAI failures return a controlled error.
- Streaming endpoint sends chunks progressively and closes cleanly.

## Chunk 6: Authorization Sweep

### Goal

Make sure all non-auth routes are protected consistently.

### Work

- Apply `JwtAuthGuard` to:
  - `UsersController`
  - `WorkoutsController`
  - `AiController`
- Keep `POST /auth/register` and `POST /auth/login` public.
- Keep `GET /auth/me` protected.
- Verify `CurrentUser` is used instead of reading raw request objects in controllers.

### Acceptance Checks

- Every route except register/login requires JWT.
- Authenticated user ID is used for all user-owned resources.
- No controller trusts user IDs from request body or params for ownership.

## Chunk 7: Testing And Verification

### Goal

Confirm the app works end to end.

### Work

- Run TypeScript build.
- Run lint.
- Add focused unit tests if time allows:
  - auth credential validation
  - workout ownership filtering
  - workout stats aggregation
- Manual API smoke test flow:
  1. Register user
  2. Login user
  3. Fetch `/auth/me`
  4. Update profile
  5. Create workouts
  6. Fetch paginated workouts
  7. Fetch last 30 days
  8. Fetch stats
  9. Call `/ai/coach`
  10. Call `/ai/coach/stream`

### Acceptance Checks

- `npm run build` passes.
- `npm run lint` passes or only reports pre-existing starter issues.
- API works with MongoDB and valid env values.

## Suggested Build Order

1. Setup and config
2. Users schema and service
3. Auth module and JWT guard
4. Profile endpoints
5. Workout CRUD
6. Workout stats and recent history
7. AI coaching response
8. AI streaming response
9. Final auth sweep and verification

## Implementation Notes

- Keep controllers thin: request validation, auth user extraction, and service calls only.
- Keep business logic in services.
- Use Mongoose `Types.ObjectId` validation before querying by ID.
- Never accept `userId` from client request bodies for workouts.
- Store password hashes only, never plaintext passwords.
- Return stable response shapes for mobile clients.
- Keep OpenAI prompt construction isolated in `AiService`.
- Prefer concise DTOs and explicit validation decorators.
