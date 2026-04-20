#!/bin/bash

# ──────────────────────────────────────────────────────────────
# QUICK DATABASE & API SETUP GUIDE
# Run this guide step-by-step to set up the profile system
# ──────────────────────────────────────────────────────────────

echo "🚀 Starting Database & Profile API Setup..."
echo ""

# Step 1: Start Docker
echo "📦 Step 1: Starting PostgreSQL and Redis..."
npm run docker:up
sleep 5

# Step 2: Check database connection
echo "✅ Step 2: Checking database connection..."
docker ps | grep postgres

if [ $? -eq 0 ]; then
    echo "✓ PostgreSQL is running"
else
    echo "✗ PostgreSQL failed to start"
    exit 1
fi

echo ""
echo "🔧 Step 3: Generating Prisma Client..."
npm run user-svc:generate

echo ""
echo "📊 Step 4: Running Database Migration..."
npm run user-svc:migrate

echo ""
echo "✅ Step 5: Verifying Migration..."
npm run user-svc:db:studio &
sleep 3

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✨ Setup Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo "   1. Verify database at: http://localhost:5555 (Prisma Studio)"
echo "   2. Start services: npm run dev"
echo "   3. Test API endpoints"
echo ""
echo "📚 Documentation: docs/PROFILE_DATABASE_UPGRADE.md"
echo ""
