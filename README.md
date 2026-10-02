# MeliAuth

Central authentication API for multiple services, built with NestJS, PostgreSQL, and asymmetric RS256 JWTs.

## Features

- Password registration/login using username, optional email, or optional phone number. Vietnamese mobile numbers are normalized to E.164 (`0901234567` becomes `+84901234567`); other countries require E.164 input.
- Minimal user profile including `emailVerified` and `phoneNumberVerified` verification status.
- Short-lived access JWT and rotating refresh JWT. Refresh sessions are hashed in PostgreSQL and can be revoked.
- RS256 signing, `kid`, issuer/audience validation, and public JWKS at `/.well-known/jwks.json`.
- HTTP-only access/refresh cookies for one or more configured parent domains; bearer tokens remain supported.
- Optional Google sign-in. Password auth is the primary flow.
- SMTP email delivery and one-time, expiring 8-digit password reset codes.
- One-time, expiring 6-digit email verification codes.
- Swagger at `/docs` and health check at `/api/v1/health`.

## Start locally

```bash
cp .env.example .env
pnpm install
pnpm keys:generate
docker compose up -d postgres
pnpm seed
pnpm dev
```

If port 5432 is already used, start PostgreSQL with `DB_PUBLISHED_PORT=55432 docker compose up -d postgres` and set `DB_PORT=55432` in `.env`.

To build and run the complete stack, generate the JWT keys first and start Compose:

```bash
pnpm keys:generate
docker compose up -d --build
```

The API is published on `APP_PUBLISHED_PORT` (default `3000`). Inside Compose, the backend connects to PostgreSQL through the `postgres` service automatically.

## CI/CD

For each pull request targeting `main`, CI first merges the PR head into the latest `main` locally. Type-checking, linting, tests, the NestJS build, Compose validation, and the Docker image build then run against that merged result. CD deploys when the validated pull request is merged and pushed to `main`.

Configure the GitHub `production` environment with these secrets:

- `SSH_HOST`, `SSH_PORT`, `SSH_USER`, and `SSH_PRIVATE_KEY` for the deployment server.
- `DEPLOY_PATH` for the checked-out repository directory on that server.

The deployment directory must already contain the production `.env` and `keys/private.pem`/`keys/public.pem`. CD pulls `main`, validates Compose, and rebuilds the running stack.

TypeORM automatically synchronizes the PostgreSQL schema from the entities when the application starts.
The idempotent seed creates the administrator with user ID `1`, ten regular accounts (`user51` through `user60`) with IDs `51–60` and empty roles, then advances the user sequence so new users start at ID `101`. Set `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` to at least 8 characters. Existing credentials are not overwritten on subsequent seed runs.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Create password account and tokens |
| POST | `/api/v1/auth/login` | Login with username, email, or phone |
| POST | `/api/v1/auth/forgot-password` | Email an 8-digit password reset code |
| POST | `/api/v1/auth/reset-password` | Reset password with the one-time code |
| POST | `/api/v1/auth/verification/send` | Send a 6-digit verification code (`{ "method": "email" }`, authenticated) |
| POST | `/api/v1/auth/verification/verify` | Verify using the 6-digit code (`{ "method": "email", "code": "012345" }`, authenticated) |
| POST | `/api/v1/auth/refresh` | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Revoke session and clear cookies |
| GET | `/api/v1/auth/info` | Current user (Bearer or access cookie) |
| PATCH | `/api/v1/auth/info` | Update display name/avatar/email/phone; changed contacts become unverified |
| POST | `/api/v1/auth/oauth/google` | Optional Google ID-token login |
| GET | `/api/v1/users` | List/search users (admin only) |
| GET | `/api/v1/users/:id` | Get a user (admin only) |
| POST | `/api/v1/users` | Create a user (admin only) |
| PATCH | `/api/v1/users/:id` | Update profile, credentials, or roles (admin only) |
| DELETE | `/api/v1/users/:id` | Delete a user (admin only) |
| GET | `/.well-known/jwks.json` | Keys for downstream JWT verification |

The login/register/refresh responses include tokens for native and service clients and also write HTTP-only cookies for browsers. Downstream services should cache the JWKS and validate all of: `alg=RS256`, `kid`, `iss`, `aud`, `exp`, and `type=access`.

### Email and password reset

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional SMTP credentials, and `MAIL_FROM`. Password reset codes contain 8 digits and expire according to `PASSWORD_RESET_TTL`; email verification codes contain 6 digits and expire according to `EMAIL_VERIFICATION_TTL` (both default to `15m`). Codes are stored only as SHA-256 hashes and are single-use.

### Cookie domains

`COOKIE_DOMAINS=.example.com` shares cookies with sibling hosts such as `app.example.com` and `admin.example.com`. Multiple values cause multiple `Set-Cookie` headers, for example `.example.com,.example.org`, but browsers only accept a cookie when the response host is allowed to set that domain. A single auth host cannot set cookies for unrelated registrable domains; those deployments need a top-level redirect/callback on each domain or bearer tokens.

For cross-site browser calls, list exact origins in `CORS_ORIGINS`, keep credentials enabled in the client, use HTTPS, and set `COOKIE_SAME_SITE=none` with `COOKIE_SECURE=true` when appropriate.

## Key rotation

Generate a new key pair, change `JWT_KEY_ID`, deploy the new private key, and keep old public keys available in JWKS until every old access token expires. This initial service exposes one active key; production rotation can extend `TokenService.getJwks()` to publish the retained public keys.

Never commit `keys/private.pem`. The `keys/` directory is ignored by Git.
