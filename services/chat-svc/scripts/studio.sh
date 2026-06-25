#!/bin/bash
# Runs Prisma Studio with Node.js 20 (required — Prisma 5.x is incompatible with Node 24+)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20 --silent
npx prisma studio --schema=./prisma/schema.prisma
