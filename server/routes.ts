import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertContactSchema, 
  insertLeadSchema, 
  insertVolunteerSchema,
  insertShopSchema,
  insertDeviceSchema,
  insertStoreItemSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { 
  sendContactNotification, 
  sendBinRequestNotification, 
  sendVolunteerNotification, 
  sendCustomEmail,
  sendPointsClaimedEmail,
  sendRedemptionEmail,
} from "./email";
import bcrypt from "bcryptjs";
import { 
  login, 
  register, 
  logout, 
  authMiddleware, 
  optionalAuthMiddleware,
  requireRole,
  authenticateDevice,
  hashDeviceKey,
  generateDeviceKey,
  generateClaimToken,
  hashPassword,
} from "./auth";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== AUTH ROUTES ====================
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      const result = await login(email, password);
      if (!result) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      res.json({ 
        user: { 
          id: result.user.id, 
          email: result.user.email, 
          role: result.user.role 
        }, 
        sessionId: result.sessionId 
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      const result = await register(email, password, "CUSTOMER");
      
      res.json({ 
        user: { 
          id: result.user.id, 
          email: result.user.email, 
          role: result.user.role 
        }, 
        sessionId: result.sessionId 
      });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });
  
  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    try {
      await logout(req.sessionId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Logout failed" });
    }
  });
  
  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    res.json({ 
      user: { 
        id: req.user!.id, 
        email: req.user!.email, 
        role: req.user!.role 
      } 
    });
  });

  app.post("/api/auth/change-password", authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new passwords required" });
      }
      
      const user = await storage.getUser(req.user!.id);
      if (!user || !user.passwordHash) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      
      const newPasswordHash = await hashPassword(newPassword);
      const updated = await storage.updateUserPassword(req.user!.id, newPasswordHash);
      
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ==================== PUBLIC FORM ROUTES ====================
  
  app.post("/api/contact", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(data);
      sendContactNotification(data).catch(err => console.error('Email error:', err));
      res.json(contact);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.post("/api/lead", async (req, res) => {
    try {
      const data = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(data);
      sendBinRequestNotification({
        businessName: data.businessName,
        contactPerson: data.contactName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        volume: data.volume || "Not specified",
      }).catch(err => console.error('Email error:', err));
      res.json(lead);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create lead" });
    }
  });
  
  // Keep old endpoint for backwards compatibility
  app.post("/api/bin-request", async (req, res) => {
    try {
      const data = {
        businessName: req.body.businessName,
        contactName: req.body.contactPerson,
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address,
        volume: req.body.volume,
      };
      const lead = await storage.createLead(data);
      sendBinRequestNotification(req.body).catch(err => console.error('Email error:', err));
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create bin request" });
    }
  });

  app.post("/api/volunteer", async (req, res) => {
    try {
      const data = insertVolunteerSchema.parse(req.body);
      const volunteer = await storage.createVolunteer(data);
      sendVolunteerNotification(data).catch(err => console.error('Email error:', err));
      res.json(volunteer);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create volunteer application" });
    }
  });

  // ==================== STAFF ROUTES ====================
  
  app.get("/api/staff/leads", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });
  
  app.patch("/api/staff/leads/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { status, notes } = req.body;
      const lead = await storage.updateLeadStatus(parseInt(req.params.id), status, notes);
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to update lead" });
    }
  });
  
  app.get("/api/staff/shops", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const shops = await storage.getAllShops();
      res.json(shops);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shops" });
    }
  });
  
  app.post("/api/staff/shops", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const data = insertShopSchema.parse(req.body);
      const shop = await storage.createShop(data);
      // Create default reward config
      await storage.createRewardConfig({ shopId: shop.id });
      res.json(shop);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create shop" });
    }
  });
  
  app.patch("/api/staff/shops/:id/status", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { status } = req.body;
      const shop = await storage.updateShopStatus(parseInt(req.params.id), status);
      res.json(shop);
    } catch (error) {
      res.status(500).json({ error: "Failed to update shop status" });
    }
  });
  
  app.post("/api/staff/shops/:shopId/members", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { email, password, role } = req.body;
      const shopId = parseInt(req.params.shopId);
      
      // Check if user exists
      let user = await storage.getUserByEmail(email);
      if (!user) {
        // Create partner user
        const passwordHash = await hashPassword(password);
        user = await storage.createUser({ email, passwordHash, role: "PARTNER" });
      }
      
      // Add as shop member
      const member = await storage.createShopMember({ userId: user.id, shopId, role: role || "MANAGER" });
      res.json({ user: { id: user.id, email: user.email }, member });
    } catch (error) {
      res.status(500).json({ error: "Failed to add shop member" });
    }
  });
  
  app.get("/api/staff/devices", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const shops = await storage.getAllShops();
      const allDevices = [];
      for (const shop of shops) {
        const devices = await storage.getDevicesByShop(shop.id);
        allDevices.push(...devices.map(d => ({ ...d, shopName: shop.name })));
      }
      res.json(allDevices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });
  
  app.post("/api/staff/devices", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { shopId, name } = req.body;
      
      // Generate device key (only shown once)
      const deviceKey = generateDeviceKey();
      const deviceKeyHash = hashDeviceKey(deviceKey);
      
      const device = await storage.createDevice({ 
        shopId: parseInt(shopId), 
        name, 
        deviceKeyHash,
        status: "ACTIVE"
      });
      
      // Auto-create a bin record linked to this device
      const bin = await storage.createBin({
        shopId: parseInt(shopId),
        deviceId: device.id,
        name: name,
        binType: "vape",
        status: "OFFLINE",
        fillLevel: 0,
        vapeCount: 0,
      });
      
      // Return the device with the key and ID (only time it's shown)
      res.json({ 
        device,
        bin,
        deviceId: device.id,
        deviceKey,
        warning: "Save this device ID and key now. They cannot be retrieved again." 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create device" });
    }
  });
  
  app.get("/api/staff/drop-events", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const shops = await storage.getAllShops();
      const allEvents = [];
      for (const shop of shops) {
        const events = await storage.getDropEventsByShop(shop.id);
        allEvents.push(...events.map(e => ({ ...e, shopName: shop.name })));
      }
      allEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(allEvents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drop events" });
    }
  });
  
  app.get("/api/staff/contacts", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });
  
  app.get("/api/staff/volunteers", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      res.json(volunteers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch volunteers" });
    }
  });
  
  app.get("/api/staff/store-items", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const items = await storage.getAllStoreItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch store items" });
    }
  });
  
  app.post("/api/staff/store-items", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const data = insertStoreItemSchema.parse(req.body);
      const item = await storage.createStoreItem(data);
      res.json(item);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create store item" });
    }
  });
  
  app.get("/api/staff/redemptions", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const redemptions = await storage.getAllRedemptions();
      res.json(redemptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch redemptions" });
    }
  });
  
  app.patch("/api/staff/redemptions/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { status } = req.body;
      const redemption = await storage.updateRedemptionStatus(parseInt(req.params.id), status);
      res.json(redemption);
    } catch (error) {
      res.status(500).json({ error: "Failed to update redemption" });
    }
  });
  
  app.get("/api/staff/pickup-requests", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const requests = await storage.getAllPickupRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pickup requests" });
    }
  });

  // ==================== PARTNER ROUTES ====================
  
  app.get("/api/partner/shops", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const shops = await storage.getShopsByMemberId(req.user!.id);
      res.json(shops);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shops" });
    }
  });
  
  app.get("/api/partner/shops/:shopId", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const shop = await storage.getShop(parseInt(req.params.shopId));
      if (!shop) {
        return res.status(404).json({ error: "Shop not found" });
      }
      
      // Verify user has access
      const shops = await storage.getShopsByMemberId(req.user!.id);
      if (!shops.find(s => s.id === shop.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(shop);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shop" });
    }
  });
  
  app.get("/api/partner/shops/:shopId/reward-config", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const config = await storage.getRewardConfig(shopId);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reward config" });
    }
  });
  
  app.patch("/api/partner/shops/:shopId/reward-config", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const config = await storage.updateRewardConfig(shopId, req.body);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reward config" });
    }
  });
  
  app.get("/api/partner/shops/:shopId/drop-events", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const events = await storage.getDropEventsByShop(parseInt(req.params.shopId));
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drop events" });
    }
  });
  
  app.get("/api/partner/shops/:shopId/stats", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const events = await storage.getDropEventsByShop(shopId);
      const devices = await storage.getDevicesByShop(shopId);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayEvents = events.filter(e => new Date(e.createdAt) >= today);
      const totalPoints = events.reduce((sum, e) => sum + e.pointsAwarded, 0);
      const todayPoints = todayEvents.reduce((sum, e) => sum + e.pointsAwarded, 0);
      
      res.json({
        totalDrops: events.length,
        todayDrops: todayEvents.length,
        totalPoints,
        todayPoints,
        activeDevices: devices.filter(d => d.status === "ACTIVE").length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
  
  app.post("/api/partner/shops/:shopId/pickup-request", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      const { notes } = req.body;
      
      const request = await storage.createPickupRequest({
        shopId,
        requestedById: req.user!.id,
        notes,
        status: "PENDING",
      });
      
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pickup request" });
    }
  });

  // ==================== CUSTOMER ROUTES ====================
  
  app.get("/api/customer/wallet", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    try {
      const customer = await storage.getCustomerByUserId(req.user!.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      
      const wallet = await storage.getWallet(customer.id);
      res.json({ customer, wallet });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch wallet" });
    }
  });
  
  app.get("/api/customer/transactions", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    try {
      const customer = await storage.getCustomerByUserId(req.user!.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      
      const wallet = await storage.getWallet(customer.id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      const transactions = await storage.getTransactionsByWallet(wallet.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  
  app.get("/api/customer/store", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    try {
      const items = await storage.getAllStoreItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch store items" });
    }
  });
  
  app.post("/api/customer/redeem", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    try {
      const { storeItemId } = req.body;
      
      const customer = await storage.getCustomerByUserId(req.user!.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      
      const wallet = await storage.getWallet(customer.id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      const item = await storage.getStoreItem(storeItemId);
      if (!item || !item.active) {
        return res.status(404).json({ error: "Store item not found" });
      }
      
      if (wallet.pointsBalance < item.pointsCost) {
        return res.status(400).json({ error: "Insufficient points" });
      }
      
      // Deduct points
      await storage.updateWalletBalance(customer.id, -item.pointsCost, false);
      
      // Create transaction
      await storage.createTransaction({
        walletId: wallet.id,
        amount: -item.pointsCost,
        type: "REDEEM",
        description: `Redeemed: ${item.name}`,
      });
      
      // Create redemption
      const redemption = await storage.createRedemption({
        customerId: customer.id,
        storeItemId: item.id,
        pointsSpent: item.pointsCost,
        status: "PENDING",
      });
      
      // Send email
      sendRedemptionEmail(req.user!.email, item.name).catch(err => console.error('Email error:', err));
      
      res.json(redemption);
    } catch (error) {
      res.status(500).json({ error: "Failed to redeem item" });
    }
  });
  
  app.get("/api/customer/redemptions", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    try {
      const customer = await storage.getCustomerByUserId(req.user!.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      
      const redemptions = await storage.getRedemptionsByCustomer(customer.id);
      res.json(redemptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch redemptions" });
    }
  });

  // ==================== CLAIM ROUTES ====================
  
  app.post("/api/claim", optionalAuthMiddleware, async (req, res) => {
    try {
      const { token, email, password } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: "Token required" });
      }
      
      const tokenHash = hashDeviceKey(token);
      const claimToken = await storage.getClaimToken(tokenHash);
      
      if (!claimToken) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      if (claimToken.claimedAt) {
        return res.status(400).json({ error: "Token already claimed" });
      }
      
      if (new Date(claimToken.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Token expired" });
      }
      
      let user = req.user;
      let sessionId: string | undefined;
      
      // If not logged in, require email/password for registration or login
      if (!user) {
        if (!email || !password) {
          return res.status(400).json({ error: "Please log in or register to claim points" });
        }
        
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          // Login
          const result = await login(email, password);
          if (!result) {
            return res.status(401).json({ error: "Invalid credentials" });
          }
          user = result.user;
          sessionId = result.sessionId;
        } else {
          // Register
          const result = await register(email, password, "CUSTOMER");
          user = result.user;
          sessionId = result.sessionId;
        }
      }
      
      // Get customer and wallet
      const customer = await storage.getCustomerByUserId(user.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      
      const wallet = await storage.getWallet(customer.id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      // Get drop event for points
      const dropEvent = await storage.getDropEvent(claimToken.dropEventId);
      if (!dropEvent) {
        return res.status(404).json({ error: "Drop event not found" });
      }
      
      // Claim the token
      const claimed = await storage.claimToken(tokenHash, user.id);
      if (!claimed) {
        return res.status(400).json({ error: "Failed to claim token" });
      }
      
      // Update wallet
      await storage.updateWalletBalance(customer.id, dropEvent.pointsAwarded, true);
      
      // Create transaction
      await storage.createTransaction({
        walletId: wallet.id,
        amount: dropEvent.pointsAwarded,
        type: "EARN",
        description: "Vape drop reward",
      });
      
      // Send email
      sendPointsClaimedEmail(user.email, dropEvent.pointsAwarded).catch(err => console.error('Email error:', err));
      
      res.json({ 
        success: true, 
        points: dropEvent.pointsAwarded,
        newBalance: wallet.pointsBalance + dropEvent.pointsAwarded,
        sessionId,
      });
    } catch (error) {
      console.error('Claim error:', error);
      res.status(500).json({ error: "Failed to claim points" });
    }
  });

  // ==================== DEVICE API (ESP32) ====================
  
  app.post("/api/device/spin", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      const deviceKey = req.headers["x-device-key"] as string;
      
      if (!deviceId || !deviceKey) {
        return res.status(401).json({ error: "Device authentication required" });
      }
      
      const auth = await authenticateDevice(deviceId, deviceKey);
      if (!auth) {
        return res.status(401).json({ error: "Invalid device credentials" });
      }
      
      const { device, shop } = auth;
      
      // Get reward config
      const config = await storage.getRewardConfig(shop.id);
      if (!config || !config.enabled) {
        return res.status(400).json({ error: "Rewards disabled for this shop" });
      }
      
      // Check daily caps
      const todayEvents = await storage.getTodayDropEventsByDevice(device.id);
      if (todayEvents.length >= config.dailySpinCap) {
        return res.status(429).json({ error: "Daily spin limit reached" });
      }
      
      const todayPoints = todayEvents.reduce((sum, e) => sum + e.pointsAwarded, 0);
      if (todayPoints >= config.dailyPointCap) {
        return res.status(429).json({ error: "Daily point limit reached" });
      }
      
      // Check rate limit
      if (todayEvents.length > 0) {
        const lastEvent = todayEvents[todayEvents.length - 1];
        const secondsSinceLast = (Date.now() - new Date(lastEvent.createdAt).getTime()) / 1000;
        if (secondsSinceLast < config.minSecondsBetweenSpins) {
          return res.status(429).json({ 
            error: "Too fast", 
            waitSeconds: Math.ceil(config.minSecondsBetweenSpins - secondsSinceLast) 
          });
        }
      }
      
      // Weighted random reward
      const rewardTable = config.rewardTableJson as { points: number; weight: number }[];
      const totalWeight = rewardTable.reduce((sum, r) => sum + r.weight, 0);
      let random = Math.random() * totalWeight;
      let points = rewardTable[0].points;
      
      for (const reward of rewardTable) {
        random -= reward.weight;
        if (random <= 0) {
          points = reward.points;
          break;
        }
      }
      
      // Create drop event
      const dropEvent = await storage.createDropEvent({
        shopId: shop.id,
        deviceId: device.id,
        pointsAwarded: points,
      });
      
      // Create claim token (expires in 3 minutes)
      const token = generateClaimToken();
      const tokenHash = hashDeviceKey(token);
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000);
      await storage.createClaimToken(tokenHash, dropEvent.id, expiresAt);
      
      res.json({
        points,
        message: `+${points} points`,
        qr_url: `https://littr.co/app/claim?token=${token}`,
        expires_in: 180,
      });
    } catch (error) {
      console.error('Device spin error:', error);
      res.status(500).json({ error: "Spin failed" });
    }
  });
  
  app.get("/api/device/status", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      const deviceKey = req.headers["x-device-key"] as string;
      
      if (!deviceId || !deviceKey) {
        return res.status(401).json({ error: "Device authentication required" });
      }
      
      const auth = await authenticateDevice(deviceId, deviceKey);
      if (!auth) {
        return res.status(401).json({ error: "Invalid device credentials" });
      }
      
      const { device, shop } = auth;
      const config = await storage.getRewardConfig(shop.id);
      const todayEvents = await storage.getTodayDropEventsByDevice(device.id);
      
      res.json({
        status: "ok",
        device: { id: device.id, name: device.name },
        shop: { id: shop.id, name: shop.name },
        rewards_enabled: config?.enabled ?? false,
        today_spins: todayEvents.length,
        daily_spin_cap: config?.dailySpinCap ?? 50,
      });
    } catch (error) {
      res.status(500).json({ error: "Status check failed" });
    }
  });

  // Rate limit tracking for telemetry (in-memory, resets on restart)
  const telemetryLastSeen = new Map<number, number>();
  const TELEMETRY_MIN_INTERVAL_MS = 30000; // 30 seconds minimum between readings
  const FIRE_ALERT_TEMP_THRESHOLD = 60; // Celsius - trigger fire alert above this

  // Device telemetry endpoint - receives sensor data from ESP32
  app.post("/api/device/telemetry", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      const deviceKey = req.headers["x-device-key"] as string;
      
      if (!deviceId || !deviceKey) {
        return res.status(401).json({ error: "Device authentication required" });
      }
      
      const auth = await authenticateDevice(deviceId, deviceKey);
      if (!auth) {
        return res.status(401).json({ error: "Invalid device credentials" });
      }
      
      const { device, shop } = auth;
      
      // Rate limiting
      const lastSeen = telemetryLastSeen.get(device.id);
      const now = Date.now();
      if (lastSeen && now - lastSeen < TELEMETRY_MIN_INTERVAL_MS) {
        const waitSeconds = Math.ceil((TELEMETRY_MIN_INTERVAL_MS - (now - lastSeen)) / 1000);
        return res.status(429).json({ error: "Too fast", waitSeconds });
      }
      telemetryLastSeen.set(device.id, now);
      
      // Validate request body
      const { temperatureC, vocAnalog, vocDigital, fillPercent } = req.body;
      
      // Basic validation
      if (fillPercent !== undefined && (fillPercent < 0 || fillPercent > 100)) {
        return res.status(400).json({ error: "fillPercent must be 0-100" });
      }
      if (vocAnalog !== undefined && (vocAnalog < 0 || vocAnalog > 4095)) {
        return res.status(400).json({ error: "vocAnalog must be 0-4095 (12-bit ADC)" });
      }
      if (temperatureC !== undefined && (temperatureC < -40 || temperatureC > 125)) {
        return res.status(400).json({ error: "temperatureC out of valid range" });
      }
      
      // Get or create bin for this device
      let bin = await storage.getBinByDeviceId(device.id);
      
      if (!bin) {
        // Auto-create bin for device if it doesn't exist
        bin = await storage.createBin({
          shopId: shop.id,
          deviceId: device.id,
          name: device.name || `Bin ${device.id}`,
          binType: "vape",
          status: "ONLINE",
          fillLevel: 0,
          vapeCount: 0,
        });
      }
      
      // Store historical reading
      await storage.createBinReading({
        binId: bin.id,
        temperature: temperatureC,
        airQuality: vocAnalog,
        vocAnalog: vocAnalog,
        vocDigital: vocDigital,
        fillLevel: fillPercent,
      });
      
      // Update bin with latest sensor data
      const updatedBin = await storage.updateBinSensorData(bin.id, {
        fillLevel: fillPercent ?? bin.fillLevel,
        lastTemperature: temperatureC ?? bin.lastTemperature,
        lastAirQuality: vocAnalog ?? bin.lastAirQuality,
        lastVocAnalog: vocAnalog ?? bin.lastVocAnalog,
        lastVocDigital: vocDigital ?? bin.lastVocDigital,
      });
      
      // Check for fire alert conditions
      let fireAlertTriggered = false;
      if (temperatureC !== undefined && temperatureC >= FIRE_ALERT_TEMP_THRESHOLD) {
        // Check if there's already an active (unacknowledged) fire alert for this bin
        const existingAlerts = await storage.getFireAlertsByShop(shop.id);
        const hasActiveAlert = existingAlerts.some(a => 
          a.binId === bin!.id && !a.acknowledged && !a.resolvedAt
        );
        
        if (!hasActiveAlert) {
          await storage.createFireAlert({
            binId: bin.id,
            shopId: shop.id,
            severity: temperatureC >= 80 ? "CRITICAL" : "HIGH",
            temperature: temperatureC,
            acknowledged: false,
          });
          fireAlertTriggered = true;
          
          // Update bin status to FIRE_ALERT
          await storage.updateBinStatus(bin.id, "FIRE_ALERT");
        }
      } else if (vocDigital === true) {
        // VOC digital pin high also indicates potential hazard
        const existingAlerts = await storage.getFireAlertsByShop(shop.id);
        const hasActiveAlert = existingAlerts.some(a => 
          a.binId === bin!.id && !a.acknowledged && !a.resolvedAt
        );
        
        if (!hasActiveAlert) {
          await storage.createFireAlert({
            binId: bin.id,
            shopId: shop.id,
            severity: "HIGH",
            temperature: temperatureC,
            acknowledged: false,
          });
          fireAlertTriggered = true;
          await storage.updateBinStatus(bin.id, "FIRE_ALERT");
        }
      }
      
      // Update device last seen
      await storage.updateDeviceLastSeen(device.id);
      
      res.json({
        status: "ok",
        binId: bin.id,
        fireAlertTriggered,
        nextPollSeconds: 60, // Recommend next poll in 60 seconds
      });
    } catch (error) {
      console.error("Telemetry error:", error);
      res.status(500).json({ error: "Telemetry failed" });
    }
  });

  // Get telemetry history for a device/bin
  app.get("/api/device/telemetry/history", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      const deviceKey = req.headers["x-device-key"] as string;
      
      if (!deviceId || !deviceKey) {
        return res.status(401).json({ error: "Device authentication required" });
      }
      
      const auth = await authenticateDevice(deviceId, deviceKey);
      if (!auth) {
        return res.status(401).json({ error: "Invalid device credentials" });
      }
      
      const bin = await storage.getBinByDeviceId(auth.device.id);
      if (!bin) {
        return res.status(404).json({ error: "No bin found for this device" });
      }
      
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const readings = await storage.getBinReadings(bin.id, limit);
      
      res.json({
        binId: bin.id,
        readings: readings.map(r => ({
          temperature: r.temperature,
          vocAnalog: r.vocAnalog,
          vocDigital: r.vocDigital,
          fillPercent: r.fillLevel,
          recordedAt: r.createdAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get telemetry history" });
    }
  });

  // ==================== LEGACY DASHBOARD ROUTES (for backwards compatibility) ====================
  
  app.get("/api/dashboard/contacts", async (req, res) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.get("/api/dashboard/bin-requests", async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      // Transform to old format for backwards compatibility
      res.json(leads.map(l => ({
        id: l.id,
        businessName: l.businessName,
        contactPerson: l.contactName,
        email: l.email,
        phone: l.phone,
        address: l.address,
        volume: l.volume,
        createdAt: l.createdAt,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bin requests" });
    }
  });

  app.get("/api/dashboard/volunteers", async (req, res) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      res.json(volunteers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch volunteers" });
    }
  });

  // Email endpoints
  app.post("/api/test-email", async (req, res) => {
    try {
      const { to } = req.body;
      const testEmail = to || 'test@example.com';
      
      const result = await sendCustomEmail(
        testEmail,
        'LITTR.co Test Email',
        `<h2>Test Email from LITTR.co</h2><p>If you received this, your email setup is working!</p><p>Sent at: ${new Date().toISOString()}</p>`
      );
      
      if (result.success) {
        res.json({ success: true, message: `Test email sent to ${testEmail}` });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/send-email", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { to, subject, html } = req.body;
      
      if (!to || !subject || !html) {
        return res.status(400).json({ error: "Missing required fields: to, subject, html" });
      }
      
      const result = await sendCustomEmail(to, subject, html);
      
      if (result.success) {
        res.json({ success: true, message: "Email sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // ==================== V1 DEVICE API (LITTR Screen Pro) ====================
  
  // New weighted point distribution
  const POINT_DISTRIBUTION = [
    { points: 1, weight: 70, label: "+1 LITTR point" },
    { points: 2, weight: 15, label: "+2 LITTR points" },
    { points: 5, weight: 10, label: "+5 LITTR points" },
    { points: 10, weight: 4, label: "+10 LITTR points" },
    { points: 25, weight: 0.9, label: "+25 LITTR points" },
    { points: 100, weight: 0.1, label: "JACKPOT! +100 LITTR points" },
  ];

  // Device pairing with Shop PIN
  app.post("/api/v1/device/pair", async (req, res) => {
    try {
      const { shopPin, deviceName, firmwareVersion } = req.body;
      
      if (!shopPin || !deviceName) {
        return res.status(400).json({ error: "shopPin and deviceName required" });
      }
      
      // Find shop by secret PIN
      const shop = await storage.getShopByPin(shopPin);
      if (!shop) {
        return res.status(404).json({ error: "Invalid shop PIN" });
      }
      
      if (shop.status !== "VERIFIED") {
        return res.status(400).json({ error: "Shop not verified" });
      }
      
      // Generate device credentials
      const deviceKey = generateDeviceKey();
      const deviceKeyHash = hashDeviceKey(deviceKey);
      
      // Create device
      const device = await storage.createDevice({
        shopId: shop.id,
        name: deviceName,
        deviceKeyHash,
        status: "ACTIVE",
      });
      
      // Create reward config if not exists
      let config = await storage.getRewardConfig(shop.id);
      if (!config) {
        config = await storage.createRewardConfig({ 
          shopId: shop.id,
          rewardTableJson: POINT_DISTRIBUTION,
        });
      }
      
      res.json({
        deviceId: device.id.toString(),
        deviceKey,
        shopId: shop.id.toString(),
        config: {
          minSecondsBetweenSpins: config.minSecondsBetweenSpins,
          enabled: config.enabled,
        },
      });
    } catch (error) {
      console.error('Device pair error:', error);
      res.status(500).json({ error: "Pairing failed" });
    }
  });

  // V1 Device spin with new point distribution
  app.post("/api/v1/device/spin", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      const deviceKey = req.headers["x-device-key"] as string;
      
      if (!deviceId || !deviceKey) {
        return res.status(401).json({ error: "Device authentication required" });
      }
      
      const auth = await authenticateDevice(deviceId, deviceKey);
      if (!auth) {
        return res.status(401).json({ error: "Invalid device credentials" });
      }
      
      const { device, shop } = auth;
      
      // Get reward config
      const config = await storage.getRewardConfig(shop.id);
      if (!config || !config.enabled) {
        return res.status(400).json({ error: "Rewards disabled for this shop" });
      }
      
      // Check rate limit (20 seconds)
      const todayEvents = await storage.getTodayDropEventsByDevice(device.id);
      const minSeconds = 20;
      
      if (todayEvents.length > 0) {
        const lastEvent = todayEvents[todayEvents.length - 1];
        const secondsSinceLast = (Date.now() - new Date(lastEvent.createdAt).getTime()) / 1000;
        if (secondsSinceLast < minSeconds) {
          return res.status(429).json({ 
            ok: false,
            error: "Too fast", 
            waitSeconds: Math.ceil(minSeconds - secondsSinceLast) 
          });
        }
      }
      
      // Use new weighted point distribution
      const totalWeight = POINT_DISTRIBUTION.reduce((sum, r) => sum + r.weight, 0);
      let random = Math.random() * totalWeight;
      let selectedReward = POINT_DISTRIBUTION[0];
      
      for (const reward of POINT_DISTRIBUTION) {
        random -= reward.weight;
        if (random <= 0) {
          selectedReward = reward;
          break;
        }
      }
      
      // Create drop event
      const dropEvent = await storage.createDropEvent({
        shopId: shop.id,
        deviceId: device.id,
        pointsAwarded: selectedReward.points,
      });
      
      // Create claim token (expires in 2 minutes as per spec)
      const token = generateClaimToken();
      const tokenHash = hashDeviceKey(token);
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      await storage.createClaimToken(tokenHash, dropEvent.id, expiresAt);
      
      res.json({
        ok: true,
        outcome: {
          points: selectedReward.points,
          label: selectedReward.label,
        },
        claim: {
          token,
          expiresAt: expiresAt.toISOString(),
          qrUrl: `https://littr.co/app/claim?token=${token}`,
        },
      });
    } catch (error) {
      console.error('V1 Device spin error:', error);
      res.status(500).json({ ok: false, error: "Spin failed" });
    }
  });

  // V1 Claim endpoint
  app.post("/api/v1/claim", optionalAuthMiddleware, async (req, res) => {
    try {
      const { token, email, password } = req.body;
      
      if (!token) {
        return res.status(400).json({ ok: false, error: "Token required" });
      }
      
      const tokenHash = hashDeviceKey(token);
      const claimToken = await storage.getClaimToken(tokenHash);
      
      if (!claimToken) {
        return res.status(404).json({ ok: false, error: "Token not found" });
      }
      
      if (claimToken.claimedAt) {
        return res.status(400).json({ ok: false, error: "Token already claimed" });
      }
      
      if (new Date(claimToken.expiresAt) < new Date()) {
        return res.status(400).json({ ok: false, error: "Token expired" });
      }
      
      let user = req.user;
      let sessionId: string | undefined;
      
      // If not logged in, require email/password for registration or login
      if (!user) {
        if (!email || !password) {
          return res.status(400).json({ 
            ok: false, 
            error: "Please log in or register to claim points",
            requiresAuth: true 
          });
        }
        
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          // Login
          const result = await login(email, password);
          if (!result) {
            return res.status(401).json({ ok: false, error: "Invalid credentials" });
          }
          user = result.user;
          sessionId = result.sessionId;
        } else {
          // Register
          const result = await register(email, password, "CUSTOMER");
          user = result.user;
          sessionId = result.sessionId;
        }
      }
      
      // Get customer and wallet
      const customer = await storage.getCustomerByUserId(user.id);
      if (!customer) {
        return res.status(404).json({ ok: false, error: "Customer profile not found" });
      }
      
      const wallet = await storage.getWallet(customer.id);
      if (!wallet) {
        return res.status(404).json({ ok: false, error: "Wallet not found" });
      }
      
      // Get drop event for points
      const dropEvent = await storage.getDropEvent(claimToken.dropEventId);
      if (!dropEvent) {
        return res.status(404).json({ ok: false, error: "Drop event not found" });
      }
      
      // Get shop info for receipt
      const shop = await storage.getShop(dropEvent.shopId);
      
      // Claim the token
      const claimed = await storage.claimToken(tokenHash, user.id);
      if (!claimed) {
        return res.status(400).json({ ok: false, error: "Failed to claim token" });
      }
      
      // Update wallet
      await storage.updateWalletBalance(customer.id, dropEvent.pointsAwarded, true);
      
      // Create transaction
      await storage.createTransaction({
        walletId: wallet.id,
        amount: dropEvent.pointsAwarded,
        type: "EARN",
        description: `Recycling reward at ${shop?.name || 'LITTR location'}`,
      });
      
      const newBalance = wallet.pointsBalance + dropEvent.pointsAwarded;
      
      // Send email
      sendPointsClaimedEmail(user.email, dropEvent.pointsAwarded).catch(err => console.error('Email error:', err));
      
      res.json({ 
        ok: true,
        receipt: {
          points: dropEvent.pointsAwarded,
          shopName: shop?.name || 'LITTR Location',
          timestamp: new Date().toISOString(),
          newBalance,
        },
        sessionId,
        user: sessionId ? { id: user.id, email: user.email, role: user.role } : undefined,
      });
    } catch (error) {
      console.error('V1 Claim error:', error);
      res.status(500).json({ ok: false, error: "Failed to claim points" });
    }
  });

  // Staff endpoint to set shop PIN
  app.patch("/api/staff/shops/:id/pin", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
        return res.status(400).json({ error: "PIN must be 6 digits" });
      }
      
      const shop = await storage.updateShopPin(parseInt(req.params.id), pin);
      res.json(shop);
    } catch (error) {
      res.status(500).json({ error: "Failed to update shop PIN" });
    }
  });

  // ==================== V1 BIN SENSOR API (ESP32) ====================
  
  // Fire detection thresholds
  const TEMP_THRESHOLDS = {
    LOW: 45,      // Warning level
    MEDIUM: 55,   // Concern level
    HIGH: 65,     // Danger level
    CRITICAL: 75, // Critical - immediate action
  };
  
  // Report sensor telemetry from ESP32 bin
  app.post("/api/v1/bin/telemetry", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      const deviceKey = req.headers["x-device-key"] as string;
      
      if (!deviceId || !deviceKey) {
        return res.status(401).json({ ok: false, error: "Device authentication required" });
      }
      
      const auth = await authenticateDevice(deviceId, deviceKey);
      if (!auth) {
        return res.status(401).json({ ok: false, error: "Invalid device credentials" });
      }
      
      const { device, shop } = auth;
      const { binId, temperature, airQuality, fillLevel, vapeCount } = req.body;
      
      if (!binId) {
        return res.status(400).json({ ok: false, error: "Bin ID required" });
      }
      
      const bin = await storage.getBin(parseInt(binId));
      if (!bin || bin.deviceId !== device.id) {
        return res.status(404).json({ ok: false, error: "Bin not found or not linked to device" });
      }
      
      // Create sensor reading
      await storage.createBinReading({
        binId: bin.id,
        temperature: temperature ?? null,
        airQuality: airQuality ?? null,
        fillLevel: fillLevel ?? null,
      });
      
      // Update bin status
      const updateData: any = { fillLevel, vapeCount };
      if (temperature !== undefined) updateData.lastTemperature = temperature;
      if (airQuality !== undefined) updateData.lastAirQuality = airQuality;
      if (vapeCount !== undefined) updateData.vapeCount = vapeCount;
      
      await storage.updateBinSensorData(bin.id, updateData);
      
      // Check for fire alert conditions
      let fireAlertCreated = false;
      if (temperature !== undefined) {
        let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null = null;
        
        if (temperature >= TEMP_THRESHOLDS.CRITICAL) {
          severity = 'CRITICAL';
        } else if (temperature >= TEMP_THRESHOLDS.HIGH) {
          severity = 'HIGH';
        } else if (temperature >= TEMP_THRESHOLDS.MEDIUM) {
          severity = 'MEDIUM';
        } else if (temperature >= TEMP_THRESHOLDS.LOW) {
          severity = 'LOW';
        }
        
        if (severity) {
          // Check for recent temp reading to calculate rise
          const recentReadings = await storage.getBinReadings(bin.id, 5);
          let tempRise = 0;
          if (recentReadings.length >= 2 && recentReadings[1].temperature) {
            tempRise = temperature - recentReadings[1].temperature;
          }
          
          // Create fire alert
          await storage.createFireAlert({
            binId: bin.id,
            shopId: shop.id,
            severity,
            temperature,
            temperatureRise: tempRise,
            acknowledged: false,
          });
          
          // Update bin status to FIRE_ALERT
          await storage.updateBinStatus(bin.id, 'FIRE_ALERT');
          fireAlertCreated = true;
        }
      }
      
      res.json({
        ok: true,
        binId: bin.id,
        status: fireAlertCreated ? 'FIRE_ALERT' : 'ONLINE',
        fireAlert: fireAlertCreated,
      });
    } catch (error) {
      console.error('Bin telemetry error:', error);
      res.status(500).json({ ok: false, error: "Failed to process telemetry" });
    }
  });
  
  // Get bin config for ESP32
  app.get("/api/v1/bin/config", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      const deviceKey = req.headers["x-device-key"] as string;
      
      if (!deviceId || !deviceKey) {
        return res.status(401).json({ ok: false, error: "Device authentication required" });
      }
      
      const auth = await authenticateDevice(deviceId, deviceKey);
      if (!auth) {
        return res.status(401).json({ ok: false, error: "Invalid device credentials" });
      }
      
      const { device, shop } = auth;
      
      // Get bins linked to this device
      const allBins = await storage.getBinsByShop(shop.id);
      const deviceBins = allBins.filter(b => b.deviceId === device.id);
      
      res.json({
        ok: true,
        deviceId: device.id,
        shopId: shop.id,
        shopName: shop.name,
        bins: deviceBins.map(b => ({
          id: b.id,
          name: b.name,
          binType: b.binType,
        })),
        config: {
          telemetryIntervalMs: 30000, // 30 seconds
          tempAlertThreshold: TEMP_THRESHOLDS.LOW,
        },
      });
    } catch (error) {
      console.error('Bin config error:', error);
      res.status(500).json({ ok: false, error: "Failed to get config" });
    }
  });
  
  // ==================== STAFF BIN MANAGEMENT ====================
  
  // Get all bins (staff only) - includes device info
  app.get("/api/staff/bins", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const allBins = await storage.getAllBinsWithDevice();
      const shops = await storage.getAllShops();
      
      // Enrich bins with shop info
      const enrichedBins = allBins.map(bin => ({
        ...bin,
        shop: shops.find(s => s.id === bin.shopId),
      }));
      
      res.json(enrichedBins);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bins" });
    }
  });

  // Delete a bin (staff only)
  app.delete("/api/staff/bins/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const binId = parseInt(req.params.id);
      if (isNaN(binId)) {
        return res.status(400).json({ error: "Invalid bin ID" });
      }
      
      const deleted = await storage.deleteBin(binId);
      if (!deleted) {
        return res.status(404).json({ error: "Bin not found" });
      }
      
      res.json({ success: true, message: "Bin deleted successfully" });
    } catch (error) {
      console.error("Error deleting bin:", error);
      res.status(500).json({ error: "Failed to delete bin" });
    }
  });
  
  // Create a bin (staff only)
  app.post("/api/staff/bins", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { shopId, name, binType, deviceId } = req.body;
      
      if (!shopId || !name) {
        return res.status(400).json({ error: "Shop ID and name required" });
      }
      
      const bin = await storage.createBin({
        shopId,
        name,
        binType: binType || 'vape',
        deviceId: deviceId || null,
        status: 'OFFLINE',
        fillLevel: 0,
        vapeCount: 0,
      });
      
      res.json(bin);
    } catch (error) {
      res.status(500).json({ error: "Failed to create bin" });
    }
  });
  
  // Get active fire alerts (staff only)
  app.get("/api/staff/fire-alerts", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const alerts = await storage.getActiveFireAlerts();
      const allBins = await storage.getAllBins();
      const shops = await storage.getAllShops();
      
      const enrichedAlerts = alerts.map(alert => ({
        ...alert,
        bin: allBins.find(b => b.id === alert.binId),
        shop: shops.find(s => s.id === alert.shopId),
      }));
      
      res.json(enrichedAlerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fire alerts" });
    }
  });
  
  // Acknowledge fire alert (staff only)
  app.patch("/api/staff/fire-alerts/:id/acknowledge", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const alert = await storage.acknowledgeFireAlert(parseInt(req.params.id), req.user!.id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  });
  
  // Resolve fire alert (staff only)
  app.patch("/api/staff/fire-alerts/:id/resolve", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const alert = await storage.resolveFireAlert(parseInt(req.params.id));
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      // Reset bin status to ONLINE
      if (alert.binId) {
        await storage.updateBinStatus(alert.binId, 'ONLINE');
      }
      
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });
  
  // Update shop coordinates (staff only)
  app.patch("/api/staff/shops/:id/coordinates", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: "Latitude and longitude required" });
      }
      
      const shop = await storage.updateShopCoordinates(parseInt(req.params.id), latitude, longitude);
      res.json(shop);
    } catch (error) {
      res.status(500).json({ error: "Failed to update coordinates" });
    }
  });
  
  // ==================== PARTNER BIN ENDPOINTS ====================
  
  // Get partner's bins
  app.get("/api/partner/shops/:shopId/bins", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      
      // Verify partner owns this shop
      const shops = await storage.getShopsByMemberId(req.user!.id);
      if (!shops.find(s => s.id === shopId)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const shopBins = await storage.getBinsByShop(shopId);
      res.json(shopBins);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bins" });
    }
  });
  
  // Get partner's fire alerts
  app.get("/api/partner/shops/:shopId/fire-alerts", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      
      // Verify partner owns this shop
      const shops = await storage.getShopsByMemberId(req.user!.id);
      if (!shops.find(s => s.id === shopId)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const alerts = await storage.getFireAlertsByShop(shopId);
      const bins = await storage.getBinsByShop(shopId);
      
      const enrichedAlerts = alerts.map(alert => ({
        ...alert,
        bin: bins.find(b => b.id === alert.binId),
      }));
      
      res.json(enrichedAlerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fire alerts" });
    }
  });
  
  // ==================== PUBLIC ENDPOINTS ====================
  
  // Get verified shops with coordinates for map
  app.get("/api/shops/locations", async (req, res) => {
    try {
      const shops = await storage.getVerifiedShopsWithCoordinates();
      res.json(shops.map(s => ({
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        latitude: s.latitude,
        longitude: s.longitude,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shop locations" });
    }
  });
  
  // Check if staff exists (for first-time setup)
  app.get("/api/setup/check", async (req, res) => {
    try {
      const hasStaff = await storage.hasAnyStaff();
      res.json({ hasStaff });
    } catch (error) {
      res.status(500).json({ error: "Failed to check setup status" });
    }
  });
  
  // First-time staff setup
  app.post("/api/setup/staff", async (req, res) => {
    try {
      // Only allow if no staff exists
      const hasStaff = await storage.hasAnyStaff();
      if (hasStaff) {
        return res.status(403).json({ error: "Staff account already exists" });
      }
      
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already in use" });
      }
      
      // Create staff user
      const result = await register(email, password, "STAFF");
      
      res.json({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
        },
        sessionId: result.sessionId,
      });
    } catch (error) {
      console.error('Setup error:', error);
      res.status(500).json({ error: "Failed to create staff account" });
    }
  });

  return httpServer;
}
