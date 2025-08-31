#!/usr/bin/env bash
set -euo pipefail

# wait for postgres via docker-compose healthcheck
echo "Waiting for postgres to be ready..."
docker-compose -f docker-compose.ci.yml exec -T postgres pg_isready -U postgres -d messaging_dev -h 127.0.0.1 -p 5432 >/dev/null 2>&1 || {
  # fallback: loop with timeout
  for i in {1..30}; do
    if docker-compose -f docker-compose.ci.yml exec -T postgres pg_isready -U postgres -d messaging_dev -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
      echo "Postgres ready"
      break
    fi
    echo "Waiting (pgsql) ... $i"
    sleep 2
  done
}

echo "Waiting for pgbouncer port (6432) to accept connections..."
for i in {1..30}; do
  if nc -z 127.0.0.1 6432 >/dev/null 2>&1; then
    echo "PgBouncer socket open"
    break
  fi
  echo "Waiting (pgbouncer) ... $i"
  sleep 2
done

echo "Waiting for redis to be ready..."
for i in {1..30}; do
  if nc -z 127.0.0.1 6379 >/dev/null 2>&1; then
    echo "Redis socket open"
    break
  fi
  echo "Waiting (redis) ... $i"
  sleep 2
done

# Quick smoke checks: attempt a prisma connection using DATABASE_URL (with pgbouncer)
echo "Waiting for Prisma connectability..."
RETRY=0
while [ $RETRY -lt 20 ]; do
  if npx prisma db pull --print >/dev/null 2>&1 ; then
    echo "Prisma can reach DB"
    exit 0
  fi
  echo "Prisma not yet reachable - retrying ($RETRY)"
  RETRY=$((RETRY+1))
  sleep 2
done

echo "Timeout waiting for DB readiness"
exit 1