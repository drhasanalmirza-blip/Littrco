// Development seed (spec §8) for the CURRENT schema. Populates:
//   - STAFF user            admin@littr.co  / admin123
//   - demo shop             "Elite Smoke Shop" (VERIFIED)
//   - PARTNER owner         partner@elite.com / partner123 (OWNER of the shop)
//   - demo LIVE device      serial BIN-DEMO0001, X-Device-Key: demo-device-key-12345
//   - reward config, a few store items
//   - notification prefs for both users (staff global-scope, partner shop-scope)
//   - one demo FINALIZED drop session with two drops + before/after photo placeholders
//
// Idempotent: every insert uses ON CONFLICT / look-up-first so re-running is safe.
// Run with a DATABASE_URL set:  tsx scripts/seed.ts

import { db } from "../server/db";
import {
  users, shops, shopMembers, devices, rewardConfigs, storeItems, notificationPrefs,
  dropSessions, drops, photos, shopPointTransactions,
  type User, type Device,
} from "../shared/schema";
import { and, eq, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { hashDeviceKey } from "../server/auth";

const DEMO_DEVICE_KEY = "demo-device-key-12345";
const DEMO_DEVICE_SERIAL = "BIN-DEMO0001";
const DEMO_CLAIM_TOKEN = "demo-claim-token-0001"; // fixed so re-runs don't duplicate
const BATTERIES_PER_VAPE = 5;
const SHOP_POINTS_PER_VAPE = 1;

async function upsertUser(email: string, password: string, role: "STAFF" | "PARTNER"): Promise<User> {
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return existing;
  const [u] = await db.insert(users)
    .values({ email, passwordHash: await bcrypt.hash(password, 10), role })
    .returning();
  return u;
}

// A FINALIZED-but-unclaimed session with two accepted drops and before/after photo
// placeholders — enough to populate the staff review queue and partner activity views.
// Guarded on the fixed claim token so re-running the seed doesn't create duplicates.
async function seedDemoSession(device: Device): Promise<void> {
  const [existing] = await db.select().from(dropSessions)
    .where(eq(dropSessions.claimToken, DEMO_CLAIM_TOKEN));
  if (existing) {
    console.log("Demo drop session already present (#" + existing.id + ")");
    return;
  }

  const accepted = 2;
  const [session] = await db.insert(dropSessions).values({
    deviceId: device.id,
    shopId: device.shopId,
    status: "FINALIZED",
    detectedDropCount: accepted,
    acceptedDropCount: accepted,
    batteriesEstimated: accepted * BATTERIES_PER_VAPE,
    shopPointsAwarded: accepted * SHOP_POINTS_PER_VAPE,
    claimToken: DEMO_CLAIM_TOKEN,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    finalizedAt: new Date(),
  }).returning();

  for (let sequence = 1; sequence <= accepted; sequence++) {
    const [drop] = await db.insert(drops).values({
      sessionId: session.id,
      sequence,
      beamPatternJson: { t0: 0, t1: 140, t2: 290 },
      tempC: 23.5,
      vocRaw: 320,
      fillPercent: 20 + sequence * 4,
      accepted: true,
      // reviewStatus defaults to UNREVIEWED — the review queue picks it up
    }).returning();

    // Before/after photo placeholders (no real files on disk; URLs are illustrative)
    const [before] = await db.insert(photos).values({
      deviceId: device.id, sessionId: session.id, dropId: drop.id,
      storageUrl: `/uploads/photos/${device.id}/demo-${drop.id}-before.jpg`,
      reason: "drop_before",
    }).returning();
    const [after] = await db.insert(photos).values({
      deviceId: device.id, sessionId: session.id, dropId: drop.id,
      storageUrl: `/uploads/photos/${device.id}/demo-${drop.id}-after.jpg`,
      reason: "drop_after",
    }).returning();

    // Link the photos back onto the drop so review-queue joins resolve the URLs
    await db.update(drops)
      .set({ beforePhotoId: before.id, afterPhotoId: after.id })
      .where(eq(drops.id, drop.id));
  }

  // Shop points are awarded at finalize (spec §finalize) — mirror that here so the
  // partner's Point balance reflects the demo session.
  if (session.shopId) {
    await db.insert(shopPointTransactions).values({
      shopId: session.shopId,
      deviceId: device.id,
      sessionId: session.id,
      amount: accepted * SHOP_POINTS_PER_VAPE,
      type: "EARNED",
      status: "POSTED",
      description: `${accepted} vape drop(s)`,
    });
  }

  console.log("Demo drop session:", `#${session.id}`, `(${accepted} drops, 4 photos)`);
}

async function seed() {
  console.log("Seeding database...");

  // ---- STAFF user ----
  const admin = await upsertUser("admin@littr.co", "admin123", "STAFF");
  console.log("Staff user:", admin.email);

  // ---- Demo shop (no unique on name — look up first) ----
  let [shop] = await db.select().from(shops).where(eq(shops.name, "Elite Smoke Shop"));
  if (!shop) {
    [shop] = await db.insert(shops).values({
      name: "Elite Smoke Shop",
      address: "123 Main Street",
      city: "Rochester",
      serviceArea: "Rochester",
      phone: "(585) 555-0123",
      status: "VERIFIED",
    }).returning();
  }
  console.log("Demo shop:", shop.name, `(#${shop.id})`);

  // ---- Reward config (shopId unique) ----
  await db.insert(rewardConfigs).values({
    shopId: shop.id,
    enabled: true,
    batteriesPerVape: BATTERIES_PER_VAPE,
    shopPointsPerVape: SHOP_POINTS_PER_VAPE,
    sessionWindowSec: 60,
    claimExpirySec: 7 * 24 * 3600,
  }).onConflictDoNothing();

  // ---- Partner user + OWNER membership ----
  const partner = await upsertUser("partner@elite.com", "partner123", "PARTNER");
  await db.insert(shopMembers)
    .values({ userId: partner.id, shopId: shop.id, role: "OWNER" })
    .onConflictDoNothing();
  console.log("Partner user:", partner.email);

  // ---- Demo LIVE device with a known key ----
  let [device] = await db.select().from(devices).where(eq(devices.serial, DEMO_DEVICE_SERIAL));
  if (!device) {
    [device] = await db.insert(devices).values({
      serial: DEMO_DEVICE_SERIAL,
      deviceKeyHash: hashDeviceKey(DEMO_DEVICE_KEY),
      shopId: shop.id,
      partnerId: partner.id,
      status: "LIVE",
      firmwareVersion: "1.0.0",
      fillPercent: 28,
      vapesSinceEmpty: 2,
      lastHeartbeatAt: new Date(),
    }).returning();
  }
  console.log("Demo device:", device.serial, `(#${device.id})`);

  // ---- Store items (no unique on name — look up first) ----
  const items = [
    { name: "Power Bank (5000mAh)", description: "Compact portable charger", pointsCost: 500 },
    { name: "LITTR T-Shirt", description: "Show your support for responsible recycling", pointsCost: 300 },
    { name: "$5 Coffee Gift Card", description: "Redeem at participating cafes", pointsCost: 200 },
  ];
  for (const item of items) {
    const [existing] = await db.select().from(storeItems).where(eq(storeItems.name, item.name));
    if (!existing) await db.insert(storeItems).values({ ...item, active: true });
  }
  console.log("Store items ensured");

  // ---- Notification prefs (spec §5.3) ----
  // Staff: global scope (shopId null). Partner: scoped to the demo shop.
  // FULL + FIRE are pre-enabled for everyone; the demo also watches the 80% fill level.
  const eventsJson = {
    full: true, fillLevels: [80], fire: true,
    tempHigh: true, vocHigh: true, offline: true, drops: false,
  };
  const [adminPrefs] = await db.select().from(notificationPrefs)
    .where(and(eq(notificationPrefs.userId, admin.id), isNull(notificationPrefs.shopId)));
  if (!adminPrefs) {
    await db.insert(notificationPrefs).values({ userId: admin.id, shopId: null, eventsJson });
  }
  await db.insert(notificationPrefs)
    .values({ userId: partner.id, shopId: shop.id, eventsJson })
    .onConflictDoNothing();
  console.log("Notification prefs ensured");

  // ---- Demo drop session with drops + photo placeholders ----
  await seedDemoSession(device);

  console.log("\n=== SEED COMPLETE ===");
  console.log("\nTest credentials:");
  console.log("Staff:   admin@littr.co / admin123");
  console.log("Partner: partner@elite.com / partner123");
  console.log("\nDevice API:");
  console.log(`Serial:       ${DEMO_DEVICE_SERIAL}`);
  console.log(`X-Device-Key: ${DEMO_DEVICE_KEY}`);
  console.log(`Demo claim:   /claim/${DEMO_CLAIM_TOKEN}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
