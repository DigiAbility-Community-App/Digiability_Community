import { PrismaClient } from './src/generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching users from user-svc database...");
  
  // We need to fetch from the user-svc database
  const userPrisma = new (require('@prisma/client').PrismaClient)({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  const users = await userPrisma.$queryRaw`SELECT id, name FROM "public"."users"`;
  
  if (!Array.isArray(users) || users.length < 2) {
    console.log(`Found only ${users?.length || 0} users. Need at least 2 users to create a chat.`);
    return;
  }

  console.log(`Found ${users.length} users. Creating a global test group chat...`);

  const memberIds = users.map(u => u.id);
  
  // Create conversation in chat-svc
  const conversation = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      name: 'Global Test Chat',
      createdBy: memberIds[0],
      members: {
        create: memberIds.map(userId => ({
          userId,
          role: 'MEMBER'
        }))
      }
    }
  });

  console.log(`✅ Created test group chat with ID: ${conversation.id}`);
  console.log("All registered users have been added to this chat!");
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
