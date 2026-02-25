import { db } from "../server/db";
import { users, shops, shopMembers, devices, rewardConfigs, storeItems, brands, subtypes } from "../shared/schema";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function seed() {
  console.log("Seeding database...");

  // Hash function for device keys
  const hashDeviceKey = (key: string) => 
    crypto.createHash("sha256").update(key).digest("hex");

  // Create staff admin user
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const [admin] = await db.insert(users).values({
    email: "admin@littr.co",
    passwordHash: adminPasswordHash,
    role: "STAFF",
  }).onConflictDoNothing().returning();
  
  console.log("Admin user:", admin?.email || "already exists");

  // Create demo shop
  const [shop] = await db.insert(shops).values({
    name: "Elite Smoke Shop",
    address: "123 Main Street",
    city: "Rochester",
    serviceArea: "Rochester",
    phone: "(585) 555-0123",
    status: "VERIFIED",
  }).onConflictDoNothing().returning();

  const shopId = shop?.id;
  console.log("Demo shop:", shop?.name || "already exists");

  if (shopId) {
    // Create reward config for shop
    await db.insert(rewardConfigs).values({
      shopId,
      enabled: true,
      minSecondsBetweenSpins: 30,
      dailySpinCap: 50,
      dailyPointCap: 200,
      rewardTableJson: [
        { points: 1, weight: 50 },
        { points: 2, weight: 30 },
        { points: 3, weight: 15 },
        { points: 5, weight: 4 },
        { points: 10, weight: 1 },
      ],
    }).onConflictDoNothing();

    // Create partner user
    const partnerPasswordHash = await bcrypt.hash("partner123", 10);
    const [partner] = await db.insert(users).values({
      email: "partner@elite.com",
      passwordHash: partnerPasswordHash,
      role: "PARTNER",
    }).onConflictDoNothing().returning();

    if (partner) {
      await db.insert(shopMembers).values({
        userId: partner.id,
        shopId,
        role: "OWNER",
      }).onConflictDoNothing();
      console.log("Partner user:", partner.email);
    }

    // Create demo device
    const deviceKey = "demo-device-key-12345";
    const deviceKeyHash = hashDeviceKey(deviceKey);
    
    const [device] = await db.insert(devices).values({
      shopId,
      name: "Bin #1",
      deviceKeyHash,
      status: "ACTIVE",
    }).onConflictDoNothing().returning();

    if (device) {
      console.log("Demo device ID:", device.id);
      console.log("Demo device key:", deviceKey);
      console.log("(Save this key for testing the ESP32 API)");
    }
  }

  // Create store items
  await db.insert(storeItems).values([
    {
      name: "Power Bank (5000mAh)",
      description: "Compact portable charger",
      pointsCost: 500,
      active: true,
    },
    {
      name: "LITTR T-Shirt",
      description: "Show your support for responsible recycling",
      pointsCost: 300,
      active: true,
    },
    {
      name: "$5 Coffee Gift Card",
      description: "Redeem at participating cafes",
      pointsCost: 200,
      active: true,
    },
  ]).onConflictDoNothing();

  console.log("Store items created");

  // Seed Upstate NY vape brands and subtypes
  const brandData = [
    { name: "Geek Bar", subtypes: ["Pulse X"] },
    { name: "Hyde", subtypes: ["N Bar Recharge"] },
    { name: "VIHO", subtypes: ["Turbo", "Supercharge"] },
    { name: "Lost Mary", subtypes: [] },
    { name: "Elf Bar", subtypes: [] },
    { name: "RAZ", subtypes: [] },
    { name: "Esco Bars", subtypes: [] },
    { name: "Breeze", subtypes: [] },
    { name: "Flum", subtypes: [] },
    { name: "Tyson", subtypes: [] },
    { name: "Mr Fog", subtypes: [] },
    { name: "Fume", subtypes: [] },
  ];

  for (const b of brandData) {
    const [brand] = await db.insert(brands).values({
      name: b.name,
      suggested: false,
    }).onConflictDoNothing().returning();

    const brandId = brand?.id;
    if (brandId && b.subtypes.length > 0) {
      for (const st of b.subtypes) {
        const existing = await db.select().from(subtypes).where(
          and(eq(subtypes.brandId, brandId), eq(subtypes.name, st))
        );
        if (existing.length === 0) {
          await db.insert(subtypes).values({
            brandId,
            name: st,
            suggested: false,
          });
        }
      }
    }
  }

  console.log("Upstate NY vape brands seeded");

  console.log("\n=== SEED COMPLETE ===");
  console.log("\nTest credentials:");
  console.log("Staff: admin@littr.co / admin123");
  console.log("Partner: partner@elite.com / partner123");
  console.log("\nDevice API:");
  console.log("X-Device-Id: 1");
  console.log("X-Device-Key: demo-device-key-12345");
  
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
