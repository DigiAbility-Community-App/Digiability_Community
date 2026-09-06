import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth, isAdminRequest } from "@/lib/auth";
import { isValidIndianPhone, INVALID_PHONE_MESSAGE } from "@/lib/validation";
import {
  WeeklySchedule,
  defaultWeeklySchedule,
  isValidWeeklySchedule,
  formatAvailabilitySummary,
} from "@/lib/availabilitySchedule";
import { getOrCreateServiceCategoryId } from "@/lib/masterCategories";

async function ensureServicesTable() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      logo TEXT,
      image TEXT,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      "contactPhone" TEXT,
      "contactEmail" TEXT,
      "contactUrl" TEXT,
      price TEXT NOT NULL DEFAULT 'Contact for pricing',
      availability TEXT NOT NULL DEFAULT 'By appointment',
      rating NUMERIC(3,2) NOT NULL DEFAULT 4.9,
      reviews INTEGER NOT NULL DEFAULT 12,
      verified BOOLEAN NOT NULL DEFAULT true,
      status TEXT NOT NULL DEFAULT 'published',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // CREATE TABLE IF NOT EXISTS above is a no-op once the table already
  // exists — this is what actually adds the column to an already-provisioned
  // database. Nullable, no backfill: existing rows just get NULL and keep
  // showing their existing `availability` text untouched.
  await dbPool.query(`
    ALTER TABLE services ADD COLUMN IF NOT EXISTS "availabilitySchedule" JSONB
  `);

  // Seed default items if empty
  const countRes = await dbPool.query(`SELECT COUNT(*) FROM services`);
  if (parseInt(countRes.rows[0].count, 10) === 0) {
    // Small local builder so the seed data below can express a schedule
    // concisely instead of spelling out all 7 days per service.
    const openDays = (dayKeys: (keyof WeeklySchedule)[], from: string, to: string): WeeklySchedule => {
      const s = defaultWeeklySchedule();
      for (const key of dayKeys) s[key] = { open: true, from, to };
      return s;
    };
    const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
    const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
    const WEEK_MINUS_SUNDAY = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

    const schedules = {
      "srv-1": openDays([...WEEKDAYS], "09:00", "17:00"),
      "srv-2": openDays([...WEEK_MINUS_SUNDAY], "09:00", "18:00"),
      "srv-3": openDays([...ALL_DAYS], "00:00", "23:59"),
      "srv-4": openDays([...WEEKDAYS], "10:00", "16:00"),
      "srv-5": openDays([...WEEK_MINUS_SUNDAY], "07:00", "21:00"),
    } as const;

    // Link each seed row to a real service_categories id (creating the
    // category if it doesn't exist yet) instead of the legacy free-text
    // slugs ("therapists", "equipment", ...) these used to hardcode — see
    // CLAUDE.md/B3: category must be a master-data id, never invented text.
    const [therapistsCatId, equipmentCatId, careCatId, legalCatId, transportCatId] = await Promise.all([
      getOrCreateServiceCategoryId("Therapists"),
      getOrCreateServiceCategoryId("Equipment Vendor"),
      getOrCreateServiceCategoryId("Respite Care"),
      getOrCreateServiceCategoryId("Legal Services"),
      getOrCreateServiceCategoryId("Transportation"),
    ]);

    const defaultServices = [
      {
        id: "srv-1",
        name: "Dr. Sarah Jenkins",
        type: "Occupational Therapist",
        category: therapistsCatId,
        logo: "👩‍⚕️",
        image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80",
        description: "Specialized in pediatric occupational therapy and sensory integration for children with autism and developmental delays.",
        location: "Downtown Clinic & Home Visits",
        contactPhone: "+1 (555) 234-5678",
        contactEmail: "sarah.jenkins@therapy.org",
        contactUrl: "https://services.digiability.org/sarah-jenkins",
        price: "₹500 - ₹1,500 / session",
        availabilitySchedule: schedules["srv-1"],
        rating: 0,
        reviews: 0,
        verified: true,
        status: "published",
      },
      {
        id: "srv-2",
        name: "Mobility Solutions Inc.",
        type: "Equipment Vendor",
        category: equipmentCatId,
        logo: "🦽",
        image: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=400&q=80",
        description: "Rental and purchase of wheelchairs, walkers, and custom-fitted seating systems. Same-day delivery available.",
        location: "Westside Hub",
        contactPhone: "+1 (555) 876-5432",
        contactEmail: "info@mobilitysolutions.com",
        contactUrl: "https://services.digiability.org/mobility-solutions",
        price: "Varies by equipment",
        availabilitySchedule: schedules["srv-2"],
        rating: 0,
        reviews: 0,
        verified: true,
        status: "published",
      },
      {
        id: "srv-3",
        name: "CareBridge Support",
        type: "Respite Care",
        category: careCatId,
        logo: "🤝",
        image: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=400&q=80",
        description: "Professional respite care providers offering short-term relief for primary caregivers. Background-checked and certified.",
        location: "All City Areas",
        contactPhone: "+1 (555) 345-6789",
        contactEmail: "contact@carebridge.org",
        contactUrl: "https://services.digiability.org/carebridge",
        price: "₹200 - ₹350 / hour",
        availabilitySchedule: schedules["srv-3"],
        rating: 0,
        reviews: 0,
        verified: true,
        status: "published",
      },
      {
        id: "srv-4",
        name: "Legal Advocates for Disability",
        type: "Legal Services",
        category: legalCatId,
        logo: "⚖️",
        image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&q=80",
        description: "Assistance with disability claims, appeals, and educational advocacy (IEP meetings).",
        location: "City Center",
        contactPhone: "+1 (555) 901-2345",
        contactEmail: "legal@disabilityadvocates.org",
        contactUrl: "https://services.digiability.org/legal-advocates",
        price: "Free consultation",
        availabilitySchedule: schedules["srv-4"],
        rating: 0,
        reviews: 0,
        verified: true,
        status: "published",
      },
      {
        id: "srv-5",
        name: "Accessible Transit Co.",
        type: "Transportation",
        category: transportCatId,
        logo: "🚐",
        image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&q=80",
        description: "Wheelchair-accessible vans and specialized transport services for medical appointments and daily commuting.",
        location: "Metro Area",
        contactPhone: "+1 (555) 456-7890",
        contactEmail: "dispatch@accessibletransit.com",
        contactUrl: "https://services.digiability.org/accessible-transit",
        price: "₹20 / km",
        availabilitySchedule: schedules["srv-5"],
        rating: 0,
        reviews: 0,
        verified: true,
        status: "published",
      },
    ];

    for (const s of defaultServices) {
      await dbPool.query(`
        INSERT INTO services (
          id, name, type, category, logo, image, description,
          location, "contactPhone", "contactEmail", "contactUrl",
          price, availability, "availabilitySchedule", rating, reviews, verified, status,
          "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        s.id, s.name, s.type, s.category, s.logo, s.image, s.description,
        s.location, s.contactPhone, s.contactEmail, s.contactUrl,
        s.price, formatAvailabilitySummary(s.availabilitySchedule), JSON.stringify(s.availabilitySchedule),
        s.rating, s.reviews, s.verified, s.status,
      ]);
    }
  }
}

// GET is intentionally public for published services — this is the mobile
// app's services-directory read API (serviceService.ts), which has no admin
// session and was never meant to need one. A logged-in admin sees drafts
// too (needed for the admin panel's own Services tab); an unauthenticated
// caller only ever sees status='published' rows, so drafts never leak.
export async function GET(request: NextRequest) {
  try {
    await ensureServicesTable();
    const isAdmin = await isAdminRequest(request);

    const result = isAdmin
      ? await dbPool.query(`SELECT * FROM services ORDER BY "createdAt" DESC`)
      : await dbPool.query(`SELECT * FROM services WHERE status = 'published' ORDER BY "createdAt" DESC`);

    return NextResponse.json({
      success: true,
      services: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch services" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureServicesTable();
    const body = await request.json();
    const {
      name,
      type,
      category,
      logo,
      image,
      description,
      location,
      contactPhone,
      contactEmail,
      contactUrl,
      price,
      availabilitySchedule,
      verified,
      status,
    } = body;

    if (!name || !type || !category || !description || !location) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (name, type, category, description, location)" },
        { status: 400 }
      );
    }
    if (!isValidIndianPhone(contactPhone)) {
      return NextResponse.json(
        { success: false, message: INVALID_PHONE_MESSAGE },
        { status: 400 }
      );
    }

    const schedule: WeeklySchedule = availabilitySchedule ?? defaultWeeklySchedule();
    if (!isValidWeeklySchedule(schedule)) {
      return NextResponse.json(
        { success: false, message: "Invalid availability schedule — every open day needs both a From and To time." },
        { status: 400 }
      );
    }

    const id = `srv-${crypto.randomUUID().slice(0, 8)}`;

    const result = await dbPool.query(`
      INSERT INTO services (
        id, name, type, category, logo, image, description,
        location, "contactPhone", "contactEmail", "contactUrl",
        price, availability, "availabilitySchedule", rating, reviews, verified, status,
        "createdAt", "updatedAt"
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,0,$15,$16,NOW(),NOW())
      RETURNING *
    `, [
      id,
      name,
      type,
      category,
      logo || "🏢",
      image || "",
      description,
      location,
      contactPhone || null,
      contactEmail || null,
      contactUrl || null,
      price || "Contact for pricing",
      formatAvailabilitySummary(schedule),
      JSON.stringify(schedule),
      verified !== undefined ? verified : true,
      status || "published",
    ]);

    return NextResponse.json({
      success: true,
      service: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to create service:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create service" },
      { status: 500 }
    );
  }
}
