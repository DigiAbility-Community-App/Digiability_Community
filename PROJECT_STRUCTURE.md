# Project Structure — Digiability Community

A comprehensive guide to the folder organization and file structure of the Digiability Community monorepo.

---

## 📑 Table of Contents

1. [Root Level](#root-level)
2. [Apps Directory](#apps-directory)
3. [Services Directory](#services-directory)
4. [Packages Directory](#packages-directory)
5. [Docker & Infrastructure](#docker--infrastructure)
6. [Documentation](#documentation)

---

## Root Level

```
digiability-community/
├── docker-compose.yml         # Infrastructure setup: PostgreSQL, Redis, PgAdmin
├── turbo.json                 # Turborepo global config (build pipeline, caching)
├── tsconfig.base.json         # Base TypeScript config (path aliases, compiler options)
├── package.json               # Root workspace package.json
├── README.md                  # Main project documentation
├── PROJECT_STRUCTURE.md       # This file
├── .gitignore                 # Git ignore rules
├── .env.example               # Environment variables template
└── node_modules/              # Installed dependencies (all workspaces)
```

### Key Files Explained

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrates PostgreSQL, Redis, and development infrastructure |
| `turbo.json` | Configures build caching, task dependencies, and parallel execution |
| `tsconfig.base.json` | Base TypeScript config with path aliases (`@digiability/*`) |
| `package.json` | Root workspace definition with npm scripts and monorepo metadata |

---

## Apps Directory

Frontend applications accessible to end users.

### Structure

```
apps/
├── admin/                     # Admin Dashboard (Next.js)
│   ├── package.json           # Admin-specific dependencies
│   ├── tsconfig.json          # Admin TypeScript config
│   ├── next.config.js         # Next.js configuration
│   ├── middleware.ts          # Next.js middleware (auth checks, redirects)
│   ├── tailwind.config.ts     # Tailwind CSS theme config
│   ├── postcss.config.js      # PostCSS plugins (autoprefixer, TailwindCSS)
│   ├── components.json        # Shadcn/ui components registry
│   ├── app/                   # Next.js app directory (SSR/SSG)
│   │   ├── layout.tsx         # Root layout (header, nav, auth context)
│   │   ├── page.tsx           # Home page (/)
│   │   ├── (auth)/            # Route group for auth pages
│   │   │   └── login/         # Login page
│   │   └── (dashboard)/       # Route group for protected pages
│   │       ├── layout.tsx     # Dashboard wrapper layout
│   │       ├── dashboard/     # Dashboard home
│   │       ├── analytics/     # Analytics page
│   │       └── settings/      # Settings management
│   ├── components/            # Reusable React components
│   │   ├── data-display/      # Tables, lists, cards
│   │   ├── layout/            # Header, sidebar, footer
│   │   ├── modals/            # Dialog components
│   │   └── shared/            # Buttons, inputs, generic UI
│   ├── lib/                   # Frontend utilities
│   │   ├── api.ts             # API client (axios instance, request interceptors)
│   │   ├── auth.ts            # Auth helpers (token management)
│   │   └── queryClient.ts     # React Query client config
│   ├── public/                # Static assets (favicon, fonts)
│   └── styles/                # Global CSS (if any)
│
└── mobile/                    # Mobile App (React Native + Expo)
    ├── package.json           # Mobile dependencies
    ├── tsconfig.json          # Mobile TypeScript config
    ├── app.json               # Expo configuration (app name, icons, plugins)
    ├── babel.config.js        # Babel configuration (JSX, modules)
    ├── App.tsx                # Entry point
    ├── assets/                # App icons, splash screen, images
    │   ├── images/
    │   ├── fonts/
    │   └── splash.png
    ├── src/
    │   ├── index.ts           # App initialization/exports
    │   │
    │   ├── screens/           # Full-screen components (pages)
    │   │   ├── HomeScreen.tsx     # Home tab screen
    │   │   ├── ChatScreen.tsx     # Chat/messaging screen
    │   │   ├── GroupsScreen.tsx   # Groups listing screen
    │   │   ├── profile/           # Profile-related screens
    │   │   │   ├── ProfileScreen.tsx
    │   │   │   └── NotificationSettingsScreen.tsx
    │   │   └── AuthScreen.tsx     # Login/register screens
    │   │
    │   ├── components/        # Reusable UI components
    │   │   ├── MessageItem.tsx    # Chat message bubble
    │   │   ├── UserCard.tsx       # User profile card
    │   │   └── shared/            # Generic components (buttons, inputs)
    │   │
    │   ├── navigation/        # React Navigation stack
    │   │   ├── AuthNavigator.tsx       # Auth screens stack
    │   │   ├── BottomTabNavigator.tsx  # Tab-based navigation
    │   │   └── RootNavigator.tsx       # Conditional routing
    │   │
    │   ├── services/          # API clients & backend integration
    │   │   ├── authService.ts     # Auth API calls (login, register, logout)
    │   │   ├── userService.ts     # User profile API calls
    │   │   ├── chatService.ts     # Chat API & WebSocket
    │   │   ├── groupService.ts    # Group API calls
    │   │   └── api.ts             # Base axios instance
    │   │
    │   ├── store/             # State management (Redux, Zustand, Context)
    │   │   ├── authSlice.ts       # Auth state
    │   │   ├── userSlice.ts       # User state (current user)
    │   │   ├── chatSlice.ts       # Chat/messages state
    │   │   └── store.ts           # Store setup & middleware
    │   │
    │   └── hooks/             # Custom React hooks
    │       ├── useAuth.ts         # Auth context/state hook
    │       ├── useChat.ts         # Chat messages hook
    │       └── useNotifications.ts # Push notifications hook
    │
    └── eas.json               # EAS Build configuration (Expo App Services)
```

### Key Files in Apps

#### Admin (`apps/admin/`)

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout, provides auth context and global styles |
| `app/(auth)/login/page.tsx` | Login page protected by middleware |
| `app/(dashboard)/layout.tsx` | Dashboard wrapper with sidebar/header |
| `lib/api.ts` | Axios instance with baseURL, interceptors, auth headers |
| `middleware.ts` | Authenticates requests, redirects unauthenticated users |

#### Mobile (`apps/mobile/`)

| File | Purpose |
|------|---------|
| `App.tsx` | Root component, renders navigation |
| `src/navigation/RootNavigator.tsx` | Conditional rendering: auth vs. app stack |
| `src/services/authService.ts` | Handles login/register API calls |
| `src/store/authSlice.ts` | Manages auth state (token, user, isLoading) |

---

## Services Directory

Backend microservices using Express.js.

### Structure

```
services/
│
├── app/                           # Main orchestration service
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts               # Server startup, middleware setup
│   │   ├── config/                # Configuration files
│   │   │   ├── database.ts        # Database connection
│   │   │   ├── redis.ts           # Redis client setup
│   │   │   └── env.ts             # Environment variable validation
│   │   ├── controllers/           # Request handlers
│   │   ├── middleware/            # Express middleware
│   │   ├── models/                # Data models/schemas
│   │   ├── routes/                # API route definitions
│   │   ├── services/              # Business logic layer
│   │   └── utils/                 # Helper utilities
│   └── dist/                      # Compiled output
│
├── user-svc/                      # Authentication & User Management ⭐
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile                 # Docker image for this service
│   ├── README.md                  # Service-specific documentation
│   ├── src/
│   │   ├── index.ts               # Server entry point
│   │   │
│   │   ├── controllers/           # HTTP request handlers
│   │   │   ├── authController.ts  # register, login, verify-email, refresh-token
│   │   │   ├── userController.ts  # get-profile, update-profile, change-password
│   │   │   └── adminController.ts # Admin user management endpoints
│   │   │
│   │   ├── models/                # Validation schemas (Zod)
│   │   │   ├── auth.model.ts      # Auth DTOs & validations
│   │   │   └── user.model.ts      # User DTOs & validations
│   │   │
│   │   ├── routes/                # Express route definitions
│   │   │   ├── authRoutes.ts      # /api/auth/* routes
│   │   │   ├── userRoutes.ts      # /api/users/* routes
│   │   │   └── index.ts           # Route registry
│   │   │
│   │   ├── services/              # Business logic (use by controllers)
│   │   │   ├── authService.ts     # JWT logic, email verification
│   │   │   ├── userService.ts     # User CRUD operations
│   │   │   ├── emailService.ts    # Nodemailer integration
│   │   │   └── passwordService.ts # Hash & verify passwords
│   │   │
│   │   ├── middleware/            # Express middleware
│   │   │   ├── authMiddleware.ts  # JWT verification
│   │   │   ├── errorHandler.ts    # Global error handling
│   │   │   └── validation.ts      # Zod schema validation
│   │   │
│   │   └── utils/                 # Utilities
│   │       ├── logger.ts          # Logging utility
│   │       ├── constants.ts       # App-wide constants
│   │       └── jwt.ts             # JWT token generation/verification
│   │
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema (User, RefreshToken, etc.)
│   │   ├── migrations/            # Database migration files
│   │   │   └── migration_timestamp_name/
│   │   │       └── migration.sql
│   │   └── seed.ts                # Database seeding (optional)
│   │
│   └── dist/                      # Compiled output
│
├── chat-svc/                      # Chat & Real-time Messaging
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   ├── src/
│   │   ├── index.ts
│   │   ├── controllers/           # Message handlers
│   │   │   ├── messageController.ts
│   │   │   └── conversationController.ts
│   │   ├── models/                # Chat data models
│   │   ├── routes/                # API endpoints
│   │   ├── services/              # Chat business logic
│   │   │   ├── messageService.ts
│   │   │   ├── websocketService.ts # WebSocket event handling
│   │   │   └── conversationService.ts
│   │   └── utils/
│   └── dist/
│
├── group-svc/                     # Group Management
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   ├── src/
│   │   ├── index.ts
│   │   ├── controllers/
│   │   │   ├── groupController.ts
│   │   │   └── memberController.ts
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── groupService.ts
│   │   │   └── memberService.ts
│   │   └── utils/
│   └── dist/
│
└── notif-svc/                     # Notification Service
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    ├── src/
    │   ├── index.ts
    │   ├── controllers/
    │   │   └── notificationController.ts
    │   ├── models/
    │   ├── routes/
    │   ├── services/
    │   │   ├── pushNotificationService.ts # Push notifications (FCM, APNS)
    │   │   ├── emailNotificationService.ts
    │   │   └── notificationService.ts
    │   └── utils/
    └── dist/
```

### Key Components in Services

#### user-svc (Authentication)

**Database Models** (`prisma/schema.prisma`):
```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String
  passwordHash    String
  isEmailVerified Boolean   @default(false)
  createdAt       DateTime  @default(now())
  refreshTokens   RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String   @db.String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

**Key Endpoints**:
- `POST /api/auth/register` — User registration
- `POST /api/auth/login` — User login (returns JWT + sets refresh cookie)
- `GET /api/auth/verify-email` — Email verification
- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/logout` — Invalidate refresh token
- `GET /api/users/:id` — Get user profile
- `PUT /api/users/:id` — Update user profile

#### chat-svc (Messaging)

**Key Endpoints**:
- `POST /api/messages` — Send message
- `GET /api/conversations/:id/messages` — Get conversation history
- `WS /socket.io` — WebSocket real-time events

#### group-svc (Group Management)

**Key Endpoints**:
- `POST /api/groups` — Create group
- `GET /api/groups` — List user's groups
- `PUT /api/groups/:id` — Update group
- `POST /api/groups/:id/members` — Add member

#### notif-svc (Notifications)

**Key Endpoints**:
- `POST /api/notifications` — Send notification
- `GET /api/notifications` — Get user notifications
- `PUT /api/notifications/:id/read` — Mark as read

---

## Packages Directory

Shared libraries used across apps and services.

### Structure

```
packages/
│
├── api/                       # API client & endpoints
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts           # Main export
│   │   ├── client.ts          # Axios instance (base config)
│   │   ├── auth.api.ts        # Auth API endpoints
│   │   │   export function register(email, password, name)
│   │   │   export function login(email, password)
│   │   │   export function logout()
│   │   ├── user.api.ts        # User API endpoints
│   │   ├── chat.api.ts        # Chat API endpoints
│   │   ├── group.api.ts       # Group API endpoints
│   │   └── admin.api.ts       # Admin endpoints
│   └── dist/
│
├── types/                     # TypeScript type definitions
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts           # Main export
│   │   ├── user.types.ts      # User, Profile, Role interfaces
│   │   │   export interface User { id, email, name, createdAt, ... }
│   │   ├── auth.types.ts      # Auth request/response types
│   │   │   export interface LoginRequest { email, password }
│   │   │   export interface LoginResponse { accessToken, user }
│   │   ├── api-response.types.ts # API response wrapper
│   │   │   export interface ApiResponse<T> { success, data, message }
│   │   ├── message.types.ts   # Message, Conversation types
│   │   ├── group.types.ts     # Group, GroupMember types
│   │   ├── conversation.types.ts
│   │   ├── socket.types.ts    # WebSocket event types
│   │   └── index.ts           # Central export file
│   └── dist/
│
└── utils/                     # Utility functions
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts           # Main export
    │   ├── validation.utils.ts # Email, password, etc. validators
    │   ├── string.utils.ts    # Slugify, truncate, capitalize, etc.
    │   ├── time.utils.ts      # Date formatting, relative times
    │   ├── encryption.utils.ts # Encrypt/decrypt helpers
    │   ├── file.utils.ts      # File handling utilities
    │   ├── constants.ts       # App-wide constants
    │   │   export const AUTH_ENDPOINTS
    │   │   export const ERROR_MESSAGES
    │   │   export const HTTP_STATUS
    │   └── index.ts           # Central export
    └── dist/
```

### Usage Example

```typescript
// In any app or service:
import { User, Message, LoginRequest } from '@digiability/types';
import { createSlug, formatDate } from '@digiability/utils';
import { authApi, userApi } from '@digiability/api';

// These are shared across all packages
const user: User = { id: '123', email: 'john@example.com', ... };
const response = await authApi.login({ email, password });
```

---

## Docker & Infrastructure

### Docker Directory

```
docker/
│
├── postgres/                  # PostgreSQL initialization
│   ├── init.sql              # Initialize database, create users, schemas
│   └── data/                 # PostgreSQL data volume (gitignored)
│
└── pgadmin/                  # PgAdmin (Database UI)
    ├── servers.json          # Pre-configured database servers
    └── config/               # PgAdmin configuration
```

### Docker Compose

Location: `docker-compose.yml`

**Services**:

1. **PostgreSQL 16**
   - Container: `digiability_postgres`
   - Port: `5432`
   - Volume: `postgres_data` (persists data)
   - Health check: Enabled

2. **Redis 7**
   - Container: `digiability_redis`
   - Port: `6379`
   - Volume: `redis_data` (AOF persistence)
   - Health check: Enabled

3. **PgAdmin** (optional)
   - Web UI for PostgreSQL management
   - Port: `5050`
   - Credentials: Configured in `.env`

---

## Documentation

```
docs/
│
├── README.md                  # Documentation index (if exists)
├── api-reference.md          # Complete API endpoint documentation
│   ├── Base URL: http://localhost:3001/api
│   ├── Auth endpoints (register, login, verify-email)
│   ├── User endpoints (get, update, delete)
│   └── Response formats & error codes
│
├── architecture.md           # System design & diagram
│   ├── High-level architecture diagram
│   ├── Authentication flow (JWT + refresh tokens)
│   ├── Service-to-service communication
│   └── Data flow diagrams
│
├── database-schema.sql       # Full database structure
│   ├── Table definitions
│   ├── Indexes
│   └── Foreign key relationships
│
├── deployment.md             # Production deployment guide
│   ├── Environment setup
│   ├── Docker build & push
│   ├── Kubernetes manifests (if applicable)
│   └── CI/CD pipelines
│
├── env-guide.md              # Environment variables reference
│   ├── Root .env variables
│   ├── Service-specific variables
│   ├── Description of each variable
│   └── Required vs. optional
│
└── websocket-events.md       # Real-time event schemas
    ├── Chat events (message:new, message:edited)
    ├── Notification events
    ├── User presence events
    └── Event payload schemas
```

---

## Build & Output

```
dist/                         # Compiled output for services/packages
node_modules/                 # All dependencies (hoisted to root)
.turbo/                       # Turborepo cache directory (gitignored)
```

---

## Summary Table

| Directory | Type | Purpose | Cached |
|-----------|------|---------|--------|
| `apps/admin` | App | Web admin dashboard (Next.js) | ✅ Build only |
| `apps/mobile` | App | Mobile app (React Native) | ✅ Build only |
| `services/user-svc` | Service | Auth & user management | ✅ Build + DB tasks |
| `services/chat-svc` | Service | Messaging & real-time | ✅ Build only |
| `packages/api` | Shared | API client | ✅ Build |
| `packages/types` | Shared | TypeScript definitions | ✅ Build |
| `packages/utils` | Shared | Helper functions | ✅ Build |

---

## Quick Navigation

- **To modify auth**: `services/user-svc/src/**`
- **To update UI components**: `apps/admin/components/` or `apps/mobile/src/components/`
- **To add API endpoint**: `packages/api/src/`and `services/*/src/routes/`
- **To add types**: `packages/types/src/`
- **To change database**: `services/user-svc/prisma/schema.prisma`
- **To configure Docker**: `docker-compose.yml`

---

**Last Updated**: April 2026
