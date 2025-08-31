# Deployment Guide

This document outlines the steps required to deploy the **Messaging Service** and its associated components, including the database, dispatcher, and scheduler. It is intended for developers or operators responsible for deploying the system on **Railway**.

---

## 1. Database (`/db`)

The database must be deployed first. After deploying the messaging-service database, you need to generate and apply the public schema. These commands are executed locally; there is no need to run them on Railway at this stage.

### 1.1 Build the Database Locally
Navigate to the `/db` directory and build the project:

```bash
cd db
export DATABASE_URL="<PASTE_RAILWAY_POSTGRES_DATABASE_PUBLIC_URL>"
pnpm build
```

This will generate the `/dist` folder containing the compiled `.js` files.

### 1.2 Apply Migrations
Once the build is complete, apply the database migrations using Prisma:

```bash
npx prisma migrate dev --name init --schema=./prisma/schema.prisma
```

### 1.3 Optional: Seed the Database
To populate the database with sample data for testing, run:

```bash
pnpm prisma db seed --schema=./prisma/schema.prisma
```

### 1.4 Reset the Database
If you encounter issues (particularly with migrations) and need to reset the database, use:

```bash
npx prisma migrate reset --schema=./prisma/schema.prisma
```

---

## 2. Dispatcher (`/dispatcher`)

The dispatcher service is deployed on **Railway**. Follow the steps below:

### 2.1 Create and Deploy the Service
1. Create a new Railway service.
2. Deploy from GitHub, selecting the `messaging-service` repository.
3. Complete Railway’s guided installation process.

### 2.2 Configure Environment Variables
Set the following environment variables in Railway:

```env
DATABASE_URL="<PASTE_RAILWAY_PGBOUNCER_DATABASE_URL>"
DECISIONTELECOM_API_KEY="<YOUR_API_KEY>"
QUEUE_BACKOFF_DELAY_MS=2000
QUEUE_MAX_ATTEMPTS=1
RAILWAY_DOCKERFILE_PATH=/dispatcher/Dockerfile
REDIS_URL="<PASTE_RAILWAY_REDIS_PUBLIC_URL>"
RESEND_API_KEY="<YOUR_API_KEY>"
WORKER_BACKOFF_DELAY_MS=2000
WORKER_CONCURRENCY=1
WORKER_MAX_ATTEMPTS=1
```

### 2.3 Configure Deployment
1. Under **Deploy**, set the **Custom Start Command**:

```bash
pnpm --filter dispatcher start
```

2. Under **Build**, configure the **Watch Paths**:

```
/app/dispatcher/*
/app/types/*
/app/db/*
/app/utils/*
!/app/scheduler/*
!/app/server/*
```

3. Trigger deployment and wait for the container to build.

---

## 3. Scheduler (`/scheduler`)

The scheduler service is also deployed on **Railway**. Deployment follows similar steps as the dispatcher.

### 3.1 Create and Deploy the Service
1. Create a new Railway service.
2. Deploy from GitHub, selecting the `messaging-service` repository.

### 3.2 Configure Environment Variables
Set the following environment variables:

```env
DATABASE_URL="<PASTE_RAILWAY_PGBOUNCER_DATABASE_URL>"
RAILWAY_DOCKERFILE_PATH=/scheduler/Dockerfile
REDIS_URL="<PASTE_RAILWAY_REDIS_URL>"
```

### 3.3 Configure Deployment
1. Under **Deploy**, set the **Custom Start Command**:

```bash
pnpm --filter scheduler start
```

2. Under **Build**, configure the **Watch Paths**:

```
/app/scheduler/*
/app/types/*
/app/db/*
/app/utils/*
!/app/dispatcher/*
!/app/server/*
```

3. Trigger deployment and wait for the container to build.
