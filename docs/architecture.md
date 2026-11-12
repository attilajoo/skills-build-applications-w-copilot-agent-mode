# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

- Presentation tier decision: Keep the React views responsible only for rendering, request orchestration, and user feedback states; all API URL construction and fetch logic stays in the shared client so each route can handle loading, empty, success, and error states consistently.
- Logic tier decision: Keep Express route handlers thin and move validation, aggregation, and business rules into explicit service functions under `octofit-tracker/backend/src`; return deliberate 4xx responses for bad IDs or missing seed data instead of leaking cast errors or 500s.
- Data tier decision: Use Mongoose schemas to enforce required fields and relationships, while the seed script uses idempotent upserts to reconcile stable demo users, teams, activities, and workout suggestions without clearing live data.
- Activity tracking approach: Accept activity creation with `userId`, `teamId`, `type`, and `minutes`, validate both references exist, compute points from exercise duration, and stamp `occurredAt` on creation.
- Team management approach: Enforce a required team name and mascot, default `members` to an empty array, and keep member IDs as references so list responses expose consistent team membership data.
- Leaderboard approach: Aggregate each team’s total activity points, sort descending, and assign a 1-based rank so the API response mirrors the scoreboard contract exactly.
- Workout suggestions approach: Match suggestions to the seeded user’s recent activity pattern or goal, include a human-readable reason, and return a 4xx for unknown email addresses rather than a generic empty result.

## Test plan

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`
  - Failure means the schema contract for `User`, `Team`, `Activity`, and `Workout` is incomplete; the seed script may also be failing to create stable demo records.
- API command: `npm run test:api --prefix octofit-tracker/backend`
  - Failure means the `/api/*` routes do not validate inputs correctly, aggregate leaderboard totals, or match workout suggestions to user behavior.
- Frontend command: `npm test --prefix octofit-tracker/frontend`
  - Failure means the presentation layer is not rendering the expected API data or accessible states for loading, empty results, and errors.
- Backend build command: `npm run build --prefix octofit-tracker/backend`
  - Failure means the TypeScript backend does not compile cleanly and likely has type or route/service issues that unit tests may not catch.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`
  - Failure means the React app, route modules, or API client wiring does not compile in production mode.
