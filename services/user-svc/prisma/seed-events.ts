import "dotenv/config";
import { PrismaClient } from "../src/generated/client";

const prisma = new PrismaClient();

const sampleEvents = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    title: "Adaptive Sports Workshop",
    category: "Skill Training",
    location: "Pune, Maharashtra",
    date: "24 AUG",
    time: "10:00 AM",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop",
    description: "Learn various adaptive and para-sports under professional coaches. This workshop focuses on archery, table tennis, and wheelchair fencing.",
    spots: 12,
    buttonType: "filled",
    externalUrl: "https://services.digiability.org/register/adaptive-sports",
    organizer: "DigiAbility Sports Foundation",
    accessibility_tags: "Wheelchair,Ramp,Helper Passes",
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    title: "Accessibility Awareness Camp",
    category: "General Support",
    location: "Mumbai",
    date: "30 AUG",
    time: "11:30 AM",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop",
    description: "A public interactive session to spread accessibility awareness across the city. Join volunteers, activists, and design professionals.",
    spots: 25,
    buttonType: "outline",
    externalUrl: "https://services.digiability.org/register/awareness-camp",
    organizer: "Sahayak Foundation",
    accessibility_tags: "Wheelchair,Sign Language,Free Entry",
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    title: "Free Legal Aid Camp",
    category: "Legal Aid",
    location: "Pune, Maharashtra",
    date: "15 March 2026",
    time: "10:00 AM",
    image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1200&auto=format&fit=crop",
    description: "Join our comprehensive legal aid camp designed to provide expert consultation and support for persons with disabilities. Our team of specialized lawyers will offer guidance on disability rights, documentation, and government schemes.",
    spots: 34,
    buttonType: "filled",
    externalUrl: "https://services.digiability.org/register/legal-aid-camp",
    organizer: "Sahayak Foundation",
    accessibility_tags: "Wheelchair,Ramp,Sign Language Interpreter,Free Entry",
  },
];

async function main() {
  console.log("🌱 Seeding sample events...");

  for (const event of sampleEvents) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: event,
      create: event,
    });
  }

  console.log("✅ Seeded sample events successfully!");
}

main()
  .catch((err) => {
    console.error("❌ Seeding events failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
