# Digiability Community — Environment Setup Guide

This guide covers all environment variables required by each service.

---

## Infrastructure (Root `.env`)

Used by `docker-compose.yml` to configure PostgreSQL, Redis, and pgAdmin containers.

Copy `.env.example` to `.env` at the repo root:

```bash
cp .env.example .env
```

| Variable           | Default             | Description               |
|--------------------|---------------------|---------------------------|
| `POSTGRES_USER`    | `digiability`       | PostgreSQL username       |
| `POSTGRES_PASSWORD`| `digiability_secret`| PostgreSQL password       |
| `POSTGRES_DB`      | `digiability_db`    | Default database name     |
| `POSTGRES_PORT`    | `5432`              | Host port for PostgreSQL  |
| `REDIS_PASSWORD`   | `redis_secret`      | Redis auth password       |
| `REDIS_PORT`       | `6379`              | Host port for Redis       |
| `PGADMIN_EMAIL`    | `admin@digiability.com` | pgAdmin login email   |
| `PGADMIN_PASSWORD` | `admin123`          | pgAdmin login password    |
| `PGADMIN_PORT`     | `5050`              | Host port for pgAdmin     |

---

## user-svc (`services/user-svc/.env`)

Copy the template:

```bash
cp services/user-svc/.env.example services/user-svc/.env
```

### Server

| Variable    | Default       | Description                    |
|-------------|---------------|--------------------------------|
| `PORT`      | `4001`        | HTTP port for the service      |
| `NODE_ENV`  | `development` | `development` or `production`  |

### Database

| Variable       | Example                                                     | Description |
|----------------|-------------------------------------------------------------|-------------|
| `DATABASE_URL` | `postgresql://digiability:digiability_secret@localhost:5432/digiability_db?schema=public` | Prisma connection string |

> When `user-svc` runs on your machine, use `localhost` because Docker publishes Postgres on host port `5432`.
> When `user-svc` runs inside Docker Compose, `docker-compose.yml` overrides `DATABASE_URL` to use the service host `postgres`.

### JWT (RS256)

| Variable          | Description                                      |
|-------------------|--------------------------------------------------|
| `JWT_PRIVATE_KEY` | RSA private key (PEM format, `\n` for newlines)  |
| `JWT_PUBLIC_KEY`  | RSA public key (PEM format, `\n` for newlines)   |
| `JWT_EXPIRES_IN`  | Access token lifetime (default: `15m`)           |

**Generate RSA key pair:**

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Then paste the contents into `.env` with `\n` replacing actual newlines:

```
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----"
```

### Refresh Token

| Variable                   | Default | Description                  |
|----------------------------|---------|------------------------------|
| `REFRESH_TOKEN_EXPIRES_DAYS` | `30`  | Refresh token lifetime (days)|

### Cookie

| Variable        | Description                         |
|-----------------|-------------------------------------|
| `COOKIE_SECRET` | Secret for cookie signing (any strong random string) |

### Email (SMTP)

| Variable     | Example                                | Description                      |
|--------------|----------------------------------------|----------------------------------|
| `MAIL_HOST`  | `smtp.gmail.com`                       | SMTP server host                 |
| `MAIL_USER`  | `yourname@gmail.com`                   | SMTP username                    |
| `MAIL_PASS`  | `xxxx xxxx xxxx xxxx`                  | App password (NOT Gmail password)|
| `EMAIL_FROM` | `"Digiability <noreply@digiability.com>"` | From header in emails         |

> **Gmail Setup:** Enable 2-Factor Authentication, then generate an App Password at [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).

### Frontend URL

| Variable          | Default                 | Description                                |
|-------------------|-------------------------|--------------------------------------------|
| `CLIENT_BASE_URL` | `http://localhost:3000` | Frontend URL used in email verification/reset links |

### Redis (Optional)

| Variable    | Example                  | Description         |
|-------------|--------------------------|---------------------|
| `REDIS_URL` | `redis://localhost:6379` | For future caching  |

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd Digiability_Community
npm install

# 2. Copy env files
cp .env.example .env
cp services/user-svc/.env.example services/user-svc/.env
# Fill in values in both files

# 3. Start infrastructure
docker-compose up -d

# 4. Generate RSA keys and add to user-svc .env
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# 5. Run database migrations
npm run db:migrate --workspace=@digiability/user-svc

# 6. Start the service
npm run dev --workspace=@digiability/user-svc
# → user-svc running on http://localhost:4001
```
