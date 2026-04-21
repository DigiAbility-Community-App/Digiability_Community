# Digiability Community

A modern, scalable monorepo platform for community management and communication. Built with **Turborepo**, **Next.js**, **React Native (Expo)**, **Express.js**, **Prisma**, and **PostgreSQL**.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Services](#-services)
- [Development Workflows](#-development-workflows)
- [System Architecture](#-system-architecture)
- [Database](#-database)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 🎯 Project Overview

Digiability Community is a comprehensive platform featuring:

- **Web Admin Panel** — Dashboard for community management (Next.js)
- **Mobile App** — Community engagement app for iOS/Android (React Native + Expo)
- **Microservices Architecture** — Five independent backend services handling auth, chat, groups, users, and notifications
- **Scalable Infrastructure** — Docker-containerized services with PostgreSQL & Redis
- **Shared Libraries** — Unified type definitions and utilities across all apps

### Key Features

✅ **Authentication & Authorization** — JWT-based auth with email verification  
✅ **User Management** — User profiles, roles, and permissions  
✅ **Chat System** — Real-time messaging with WebSocket support  
✅ **Group Management** — Create and manage community groups  
✅ **Notifications** — Push notifications and in-app alerts  
✅ **Admin Dashboard** — Comprehensive admin controls  

---

## 🛠 Tech Stack

| **Layer** | **Technologies** |
|-----------|------------------|
| **Web UI** | Next.js 13+, React 19, TypeScript, TailwindCSS |
| **Mobile** | React Native, Expo, React Navigation |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL 16, Prisma ORM |
| **Cache/Pub-Sub** | Redis 7 |
| **Tooling** | Turborepo, Docker, Docker Compose |
| **Package Manager** | npm workspaces |

---

## 📁 Project Structure

```
digiability-community/
├── apps/                          # Frontend applications
│   ├── admin/                     # Admin dashboard (Next.js)
│   │   ├── components/            # Reusable React components
│   │   ├── app/                   # Next.js app directory
│   │   │   ├── (auth)/           # Auth pages (login, register)
│   │   │   └── (dashboard)/      # Dashboard pages
│   │   └── lib/                   # Utilities (API client, auth helpers)
│   │
│   └── mobile/                    # Mobile app (Expo)
│       ├── src/
│       │   ├── screens/           # Screen components
│       │   ├── components/        # Reusable components
│       │   ├── navigation/        # React Navigation setup
│       │   ├── services/          # API services
│       │   ├── store/             # State management
│       │   └── hooks/             # Custom React hooks
│       └── assets/                # Images, fonts, etc.
│
├── services/                      # Backend microservices
│   ├── app/                       # Main app orchestration service
│   ├── user-svc/                  # Auth & User Management
│   │   ├── src/
│   │   │   ├── controllers/       # Request handlers
│   │   │   ├── models/            # Data models
│   │   │   ├── routes/            # API routes
│   │   │   ├── services/          # Business logic
│   │   │   ├── middleware/        # Auth, validation, etc.
│   │   │   └── utils/             # Helper utilities
│   │   └── prisma/                # Database schema & migrations
│   │
│   ├── chat-svc/                  # Chat & Messaging Service
│   ├── group-svc/                 # Group Management Service
│   └── notif-svc/                 # Notification Service
│
├── packages/                      # Shared libraries
│   ├── api/                       # API client and endpoints
│   ├── types/                     # TypeScript type definitions
│   └── utils/                     # Utility functions
│
├── docker/                        # Docker configuration
│   ├── postgres/                  # PostgreSQL initialization
│   └── pgadmin/                   # PgAdmin configuration
│
├── docs/                          # Documentation
│   ├── api-reference.md           # API endpoints
│   ├── architecture.md            # Architecture overview
│   ├── database-schema.sql        # Database structure
│   ├── deployment.md              # Deployment guide
│   ├── env-guide.md               # Environment variables
│   └── websocket-events.md        # WebSocket events
│
├── docker-compose.yml             # Infrastructure setup (DB, Redis, etc.)
├── turbo.json                     # Turborepo configuration
├── tsconfig.base.json             # Base TypeScript configuration
├── package.json                   # Root workspace configuration
└── README.md                      # This file
```

For detailed structure, see [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** && **Docker Compose** (for running services)

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/yourusername/digiability-community.git
cd digiability-community

# Install dependencies
npm install
```

### 2. Configure Environment Variables

Create `.env` files in root and each service:

```bash
# Root .env (for Docker)
POSTGRES_USER=digiability
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=digiability_db
POSTGRES_PORT=5432
REDIS_PASSWORD=your_redis_password
REDIS_PORT=6379

# services/user-svc/.env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://digiability:password@localhost:5432/digiability_db
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=15m
REFRESH_TOKEN_EXPIRE=7d
```

See [docs/env-guide.md](./docs/env-guide.md) for complete variables.

### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis
npm run docker:up

# View logs
npm run docker:logs
```

### 4. Initialize Database

```bash
# Generate Prisma client
npm run user-svc:generate

# Run migrations
npm run user-svc:migrate
```

### 5. Run Development Mode

```bash
# Start all services in development mode
npm run dev

# Or start specific service
npm run user-svc:dev
```

### 6. Run Mobile App

```bash
cd apps/mobile
npm start
```

Select platform:
- `a` for Android
- `i` for iOS
- `w` for Web

---

## 🏢 Services

### **user-svc** — Authentication & User Management
- **Port**: 3001
- **Database**: PostgreSQL + Prisma
- **Features**:
  - User registration & email verification
  - JWT-based authentication
  - Password reset & change
  - User profile management
- **API**: [POST/GET user endpoints](./docs/api-reference.md)

### **chat-svc** — Chat & Real-time Messaging
- **Port**: 3002
- **Features**: Direct messaging, group chats, message history
- **Protocol**: WebSocket for real-time events

### **group-svc** — Group Management
- **Port**: 3003
- **Features**: Create groups, manage members, group settings

### **notif-svc** — Notifications
- **Port**: 3004
- **Features**: Push notifications, in-app notifications, email alerts

### **app** — Main Orchestration Service
- **Port**: 3000
- **Features**: Request routing, API gateway functionality

---

## 💻 Development Workflows

### Yarn Workspaces & Turborepo

This project uses **npm workspaces** + **Turborepo** for efficient monorepo management.

```bash
# Install dependencies for all workspaces
npm install

# Run build tasks in dependency order
npm run build

# Run linting
npm run lint

# Run tests
npm run test

# Run dev servers (cached tasks)
npm run dev
```

### Adding a New Package

```bash
# Create new package
mkdir packages/my-package
cd packages/my-package
npm init -y
```

### Running Workspace-Specific Commands

```bash
# Run specific workspace command
npm run dev --workspace=@digiability/user-svc

# Run tests only in admin app
npm run test --workspace=@digiability/admin
```

---

## 🏗 System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Client Layer                          │
├──────────────────────┬──────────────────────────────────┤
│  Admin Web App       │  Mobile App (Expo)              │
│  (Next.js)          │  (React Native)                  │
└──────────────────────┴──────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│            API Gateway / Load Balancer                   │
│               (app service)                             │
└──────────────────────┬──────────────────────────────────┘
            ↓                    ↓
        ┌─────────────┬──────────┬─────────────┐
        │             │          │             │
    user-svc     chat-svc   group-svc    notif-svc
    (3001)       (3002)      (3003)       (3004)
        │             │          │             │
        └─────────────┴──────────┴─────────────┘
                    ↓
        ┌───────────────────────────┐
        │   Shared Data Layer       │
        ├───────────────────────────┤
        │  PostgreSQL  │   Redis    │
        └───────────────────────────┘
```

### Authentication Flow

See [docs/architecture.md](./docs/architecture.md) for detailed JWT flow and security patterns.

---

## 🗄 Database

### Tools

- **ORM**: Prisma 5.14.0
- **Database**: PostgreSQL 16
- **Migrations**: Prisma Migrate

### Common Database Commands

```bash
# Create a new migration
npm run user-svc:migrate -- --name add_new_field

# Push schema changes (dev only, no migration file)
npm run user-svc:db:push

# Open Prisma Studio GUI
npm run user-svc:db:studio

# Generate Prisma client
npm run user-svc:generate
```

### Schema Location

- `services/user-svc/prisma/schema.prisma` — Main schema

---

## 📚 API Documentation

All API endpoints are documented here:

- [API Reference](./docs/api-reference.md)
- [WebSocket Events](./docs/websocket-events.md)

**Base URL**: `http://localhost:3000/api`

### Example Requests

```bash
# Register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "secure_password"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "secure_password"
  }'
```

---

## 🚀 Deployment

For deployment instructions, see [docs/deployment.md](./docs/deployment.md)

### Deployment Targets

- **Frontend**: Vercel, Netlify, AWS S3 + CloudFront
- **Mobile**: Apple App Store, Google Play Store (via Expo)
- **Backend**: Docker (AWS ECS, GKE, Render, Railway, etc.)

---

## 📖 Additional Documentation

| Document | Purpose |
|----------|---------|
| [Project Structure](./PROJECT_STRUCTURE.md) | Detailed folder breakdown |
| [Architecture](./docs/architecture.md) | System design & auth flow |
| [API Reference](./docs/api-reference.md) | All endpoints & schemas |
| [Database Schema](./docs/database-schema.sql) | Database structure |
| [Environment Guide](./docs/env-guide.md) | All required env variables |
| [WebSocket Events](./docs/websocket-events.md) | Real-time event schemas |
| [Deployment](./docs/deployment.md) | Production deployment |

---

## 🔒 Security

- ✅ JWT-based authentication (RS256)
- ✅ HTTP-only refresh token cookies
- ✅ Password hashing with bcryptjs
- ✅ Email verification required
- ✅ CORS configured per environment
- ✅ Environment variable isolation

See [Architecture Guide](./docs/architecture.md) for security patterns.

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run tests: `npm run test`
4. Lint code: `npm run lint`
5. Commit with clear messages
6. Push and create a Pull Request

---

## 📄 License

This project is proprietary and confidential.

---

## 👥 Team & Support

For questions or issues:

- 📧 Email: [your-email@example.com](mailto:your-email@example.com)
- 🐛 Report bugs: [GitHub Issues](https://github.com/yourusername/digiability-community/issues)
- 📚 Wiki: [Project Wiki](https://github.com/yourusername/digiability-community/wiki)

---

## 📊 Repository Statistics

- **Monorepo Type**: Turborepo + npm workspaces
- **Node.js**: ≥ 18.0.0
- **Main Language**: TypeScript
- **Frontend Frameworks**: Next.js, React, React Native
- **Backend Framework**: Express.js
- **Database**: PostgreSQL 16
- **Cache**: Redis 7

---

**Last Updated**: April 2026  
**Maintained By**: Digiability Development Team
