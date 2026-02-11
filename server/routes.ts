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
          role: result.user.role,
          themePreference: result.user.themePreference || 'light',
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
    const fullUser = await storage.getUser(req.user!.id);
    res.json({ 
      user: { 
        id: req.user!.id, 
        email: req.user!.email, 
        role: req.user!.role,
        themePreference: fullUser?.themePreference || 'light',
      } 
    });
  });

  app.patch("/api/auth/theme", authMiddleware, async (req, res) => {
    try {
      const { theme } = req.body;
      if (!theme || !['light', 'dark'].includes(theme)) {
        return res.status(400).json({ error: "Invalid theme" });
      }
      await storage.updateUserTheme(req.user!.id, theme);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update theme" });
    }
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
  
  app.get("/api/staff/activity-log", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const log = await storage.getActivityLog();
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity log" });
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

  app.delete("/api/staff/shops/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const success = await storage.deleteShop(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ error: "Shop not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete shop" });
    }
  });

  app.get("/api/staff/partner-redemptions", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const redemptions = await storage.getAllPartnerRedemptions();
      res.json(redemptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch partner redemptions" });
    }
  });

  app.patch("/api/staff/partner-redemptions/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { status } = req.body;
      const redemption = await storage.updatePartnerRedemptionStatus(parseInt(req.params.id), status);
      res.json(redemption);
    } catch (error) {
      res.status(500).json({ error: "Failed to update partner redemption" });
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

  app.get("/api/partner/store", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const items = await storage.getStoreItemsByCategory('partner');
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch partner store items" });
    }
  });

  app.post("/api/partner/redeem", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const { storeItemId } = req.body;
      const user = req.user!;
      
      const shops = await storage.getShopsByMemberId(user.id);
      const shop = shops[0];
      if (!shop) {
        return res.status(404).json({ error: "No shop found for your account" });
      }
      
      const item = await storage.getStoreItem(storeItemId);
      if (!item || !item.active || item.category !== 'partner') {
        return res.status(404).json({ error: "Store item not found" });
      }
      
      const totalPoints = await storage.getPartnerPointsTotal(shop.id);
      if (totalPoints < item.pointsCost) {
        return res.status(400).json({ error: "Insufficient points" });
      }
      
      await storage.deductPartnerPoints(shop.id, item.pointsCost, `Redeemed: ${item.name}`);
      
      const redemption = await storage.createPartnerRedemption({
        userId: user.id,
        shopId: shop.id,
        storeItemId: item.id,
        pointsSpent: item.pointsCost,
        status: "PENDING",
      });
      
      sendRedemptionEmail(user.email, item.name).catch(err => console.error('Email error:', err));
      
      res.json(redemption);
    } catch (error) {
      res.status(500).json({ error: "Failed to redeem item" });
    }
  });

  app.get("/api/partner/redemptions", authMiddleware, requireRole("PARTNER"), async (req, res) => {
    try {
      const shops = await storage.getShopsByMemberId(req.user!.id);
      const shop = shops[0];
      if (!shop) return res.json([]);
      const redemptions = await storage.getPartnerRedemptions(shop.id);
      res.json(redemptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch redemptions" });
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
      const items = await storage.getStoreItemsByCategory('customer');
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

  app.post("/api/customer/survey", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    try {
      const { surveyType, answers } = req.body;
      
      const customer = await storage.getCustomerByUserId(req.user!.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      
      if (surveyType === 'signup') {
        const existing = await storage.getLatestSurveyByType(customer.id, 'signup');
        if (existing) {
          return res.status(400).json({ error: "You've already completed the sign-up survey" });
        }
      }
      
      if (surveyType === 'weekly') {
        const latest = await storage.getLatestSurveyByType(customer.id, 'weekly');
        if (latest) {
          const daysSince = (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 7) {
            return res.status(400).json({ error: "You can take the weekly survey once per week", nextAvailable: new Date(new Date(latest.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000) });
          }
        }
      }
      
      const pointsAwarded = surveyType === 'signup' ? 20 : 3;
      
      const response = await storage.createSurveyResponse({
        customerId: customer.id,
        surveyType,
        answers,
        pointsAwarded,
      });
      
      const wallet = await storage.getWallet(customer.id);
      if (wallet) {
        await storage.updateWalletBalance(customer.id, pointsAwarded, true);
        await storage.createTransaction({
          walletId: wallet.id,
          amount: pointsAwarded,
          type: "EARN",
          description: surveyType === 'signup' ? 'Welcome survey bonus' : 'Weekly survey bonus',
        });
      }
      
      res.json({ ok: true, pointsAwarded, response });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit survey" });
    }
  });

  app.get("/api/customer/survey/status", authMiddleware, requireRole("CUSTOMER"), async (req, res) => {
    try {
      const customer = await storage.getCustomerByUserId(req.user!.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer profile not found" });
      }
      
      const signupSurvey = await storage.getLatestSurveyByType(customer.id, 'signup');
      const weeklySurvey = await storage.getLatestSurveyByType(customer.id, 'weekly');
      
      let weeklyAvailable = true;
      let nextWeeklyDate = null;
      
      if (weeklySurvey) {
        const daysSince = (Date.now() - new Date(weeklySurvey.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          weeklyAvailable = false;
          nextWeeklyDate = new Date(new Date(weeklySurvey.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
        }
      }
      
      res.json({
        signupCompleted: !!signupSurvey,
        weeklyAvailable,
        nextWeeklyDate,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch survey status" });
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
  
  // ==================== STAFF MAILBOX ENDPOINTS ====================
  
  // Get all mailboxes (staff only - for admin)
  app.get("/api/staff/mailboxes", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const allMailboxes = await storage.getAllMailboxes();
      const users = await Promise.all(allMailboxes.map(async m => {
        const user = await storage.getUser(m.userId);
        return { ...m, user: user ? { id: user.id, email: user.email, role: user.role } : null };
      }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch mailboxes" });
    }
  });
  
  // Create mailbox for a staff user (staff only)
  app.post("/api/staff/mailboxes", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { userId, emailAddress, displayName } = req.body;
      if (!userId || !emailAddress || !displayName) {
        return res.status(400).json({ error: "userId, emailAddress, and displayName required" });
      }
      
      // Validate email format
      if (!emailAddress.endsWith("@littr.co")) {
        return res.status(400).json({ error: "Email must end with @littr.co" });
      }
      
      // Check if user exists and is staff
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.role !== "STAFF") {
        return res.status(400).json({ error: "Mailboxes can only be created for staff users" });
      }
      
      // Check if email already exists
      const existing = await storage.getMailboxByEmail(emailAddress);
      if (existing) {
        return res.status(400).json({ error: "Email address already in use" });
      }
      
      // Check if user already has a mailbox
      const userMailbox = await storage.getMailboxByUserId(userId);
      if (userMailbox) {
        return res.status(400).json({ error: "User already has a mailbox" });
      }
      
      const mailbox = await storage.createMailbox({ userId, emailAddress, displayName, isActive: true });
      res.json(mailbox);
    } catch (error) {
      res.status(500).json({ error: "Failed to create mailbox" });
    }
  });
  
  // Update mailbox (staff only)
  app.patch("/api/staff/mailboxes/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { displayName, isActive } = req.body;
      const mailbox = await storage.updateMailbox(parseInt(req.params.id), { displayName, isActive });
      if (!mailbox) {
        return res.status(404).json({ error: "Mailbox not found" });
      }
      res.json(mailbox);
    } catch (error) {
      res.status(500).json({ error: "Failed to update mailbox" });
    }
  });
  
  // Delete mailbox (staff only)
  app.delete("/api/staff/mailboxes/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const deleted = await storage.deleteMailbox(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ error: "Mailbox not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete mailbox" });
    }
  });
  
  // ==================== STAFF INBOX ENDPOINTS ====================
  
  // Get current user's mailbox
  app.get("/api/inbox/mailbox", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const mailbox = await storage.getMailboxByUserId(req.user!.id);
      if (!mailbox) {
        return res.status(404).json({ error: "No mailbox found for this user" });
      }
      const unreadCount = await storage.getUnreadCount(mailbox.id);
      res.json({ ...mailbox, unreadCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch mailbox" });
    }
  });
  
  // Get inbox messages
  app.get("/api/inbox/messages", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const mailbox = await storage.getMailboxByUserId(req.user!.id);
      if (!mailbox) {
        return res.status(404).json({ error: "No mailbox found" });
      }
      
      const messages = await storage.getInboxMessages(mailbox.id);
      // Enrich with sender info
      const allMailboxes = await storage.getAllMailboxes();
      const enrichedMessages = messages.map(m => ({
        ...m,
        fromMailbox: allMailboxes.find(mb => mb.id === m.fromMailboxId),
      }));
      res.json(enrichedMessages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  
  // Get sent messages
  app.get("/api/inbox/sent", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const mailbox = await storage.getMailboxByUserId(req.user!.id);
      if (!mailbox) {
        return res.status(404).json({ error: "No mailbox found" });
      }
      
      const messages = await storage.getSentMessages(mailbox.id);
      const allMailboxes = await storage.getAllMailboxes();
      const enrichedMessages = messages.map(m => ({
        ...m,
        toMailbox: m.toMailboxId ? allMailboxes.find(mb => mb.id === m.toMailboxId) : null,
      }));
      res.json(enrichedMessages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sent messages" });
    }
  });
  
  // Get single message
  app.get("/api/inbox/messages/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const mailbox = await storage.getMailboxByUserId(req.user!.id);
      if (!mailbox) {
        return res.status(404).json({ error: "No mailbox found" });
      }
      
      const message = await storage.getInternalMessage(parseInt(req.params.id));
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Verify user has access to this message
      if (message.toMailboxId !== mailbox.id && message.fromMailboxId !== mailbox.id) {
        return res.status(403).json({ error: "Not authorized to view this message" });
      }
      
      // Mark as read if it's in their inbox
      if (message.toMailboxId === mailbox.id && !message.isRead) {
        await storage.markMessageAsRead(message.id);
      }
      
      const allMailboxes = await storage.getAllMailboxes();
      res.json({
        ...message,
        fromMailbox: allMailboxes.find(mb => mb.id === message.fromMailboxId),
        toMailbox: message.toMailboxId ? allMailboxes.find(mb => mb.id === message.toMailboxId) : null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch message" });
    }
  });
  
  // Send message (internal or external)
  app.post("/api/inbox/send", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const mailbox = await storage.getMailboxByUserId(req.user!.id);
      if (!mailbox) {
        return res.status(404).json({ error: "No mailbox found" });
      }
      
      const { to, subject, body } = req.body;
      if (!to || !subject || !body) {
        return res.status(400).json({ error: "to, subject, and body required" });
      }
      
      // Determine if internal or external
      const isInternalEmail = to.endsWith("@littr.co");
      
      if (isInternalEmail) {
        // Internal message - find the recipient mailbox
        const recipientMailbox = await storage.getMailboxByEmail(to);
        if (!recipientMailbox) {
          return res.status(404).json({ error: "Recipient mailbox not found" });
        }
        
        // Create message in recipient's inbox
        const message = await storage.createInternalMessage({
          fromMailboxId: mailbox.id,
          toMailboxId: recipientMailbox.id,
          subject,
          body,
          isRead: false,
          isArchived: false,
          isOutbound: false,
        });
        
        // Create copy in sender's sent folder
        await storage.createInternalMessage({
          fromMailboxId: mailbox.id,
          toMailboxId: recipientMailbox.id,
          subject,
          body,
          isRead: true,
          isArchived: false,
          isOutbound: true,
        });
        
        res.json({ success: true, message });
      } else {
        // External email - use Resend
        const sent = await sendCustomEmail(to, subject, body, mailbox.emailAddress);
        
        // Log outbound message
        await storage.createInternalMessage({
          fromMailboxId: mailbox.id,
          toMailboxId: null,
          toExternal: to,
          subject,
          body,
          isRead: true,
          isArchived: false,
          isOutbound: true,
        });
        
        res.json({ success: sent });
      }
    } catch (error) {
      console.error('Send error:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  
  // Archive message
  app.patch("/api/inbox/messages/:id/archive", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const mailbox = await storage.getMailboxByUserId(req.user!.id);
      if (!mailbox) {
        return res.status(404).json({ error: "No mailbox found" });
      }
      
      const message = await storage.getInternalMessage(parseInt(req.params.id));
      if (!message || message.toMailboxId !== mailbox.id) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      const archived = await storage.archiveMessage(message.id);
      res.json(archived);
    } catch (error) {
      res.status(500).json({ error: "Failed to archive message" });
    }
  });
  
  // Get all users for staff management
  app.get("/api/staff/users", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safeUsers = allUsers.map(({ passwordHash, ...rest }) => rest);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user role
  app.patch("/api/staff/users/:id/role", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { role } = req.body;
      if (!["STAFF", "PARTNER", "CUSTOMER"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      const updated = await storage.updateUserRole(req.params.id, role);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      const { passwordHash, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  // Reset user password (staff sets new password)
  app.patch("/api/staff/users/:id/password", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      const newHash = await hashPassword(password);
      const updated = await storage.updateUserPassword(req.params.id, newHash);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Create new user account (staff)
  app.post("/api/staff/users", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const { email, password, role } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      if (!["STAFF", "PARTNER", "CUSTOMER"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({ email, passwordHash, role });
      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  
  app.delete("/api/staff/users/:id", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const targetId = req.params.id;
      if (targetId === (req as any).user.id) {
        return res.status(400).json({ error: "You cannot delete your own account" });
      }
      const deleted = await storage.deleteUser(targetId);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
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

  // ==================== V2 SMART BIN API ====================

  function rollPointsV2(): number {
    return Math.floor(Math.random() * 3) + 1;
  }

  function generatePairCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // V2 Pair Request — ESP32 calls with its UID to get a pair code
  app.post("/api/v2/device/pair-request", async (req, res) => {
    try {
      const { uid, firmwareVersion } = req.body;
      if (!uid) {
        return res.status(400).json({ ok: false, error: "uid required" });
      }

      const existingDevice = await storage.getDeviceByUid(uid);
      if (existingDevice && existingDevice.shopId && existingDevice.status === "ACTIVE") {
        return res.status(200).json({
          ok: true,
          status: "already_paired",
          deviceId: existingDevice.id,
        });
      }

      const activePR = await storage.getActivePairRequestByUid(uid);
      if (activePR) {
        return res.status(200).json({
          ok: true,
          status: "pending",
          pairCode: activePR.pairCode,
          expiresAt: activePR.expiresAt.toISOString(),
        });
      }

      const pairCode = generatePairCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const pr = await storage.createPairRequest({
        uid,
        pairCode,
        firmwareVersion: firmwareVersion || null,
        expiresAt,
      });

      res.json({
        ok: true,
        status: "pending",
        pairCode: pr.pairCode,
        expiresAt: pr.expiresAt.toISOString(),
      });
    } catch (error) {
      console.error("V2 pair-request error:", error);
      res.status(500).json({ ok: false, error: "Pair request failed" });
    }
  });

  // V2 Pair Claim — partner/staff scans QR or enters code to claim device
  app.post("/api/v2/device/pair-claim", authMiddleware, async (req, res) => {
    try {
      const user = req.user!;
      const { pairCode, shopId } = req.body;

      if (!pairCode || !shopId) {
        return res.status(400).json({ ok: false, error: "pairCode and shopId required" });
      }

      if (user.role !== "STAFF" && user.role !== "PARTNER") {
        return res.status(403).json({ ok: false, error: "Staff or partner role required" });
      }

      if (user.role === "PARTNER") {
        const memberShops = await storage.getShopsByMemberId(user.id);
        if (!memberShops.find(s => s.id === parseInt(shopId))) {
          return res.status(403).json({ ok: false, error: "Not a member of this shop" });
        }
      }

      const shop = await storage.getShop(parseInt(shopId));
      if (!shop || shop.status !== "VERIFIED") {
        return res.status(400).json({ ok: false, error: "Shop not found or not verified" });
      }

      const pr = await storage.getPairRequestByCode(pairCode.toUpperCase());
      if (!pr) {
        return res.status(404).json({ ok: false, error: "Pair code not found" });
      }
      if (pr.claimed) {
        return res.status(400).json({ ok: false, error: "Pair code already claimed" });
      }
      if (new Date(pr.expiresAt) < new Date()) {
        return res.status(400).json({ ok: false, error: "Pair code expired" });
      }

      let device = await storage.getDeviceByUid(pr.uid);
      if (!device) {
        const deviceKey = generateDeviceKey();
        const deviceKeyHash = hashDeviceKey(deviceKey);
        device = await storage.createDevice({
          shopId: shop.id,
          name: `Bin ${pr.uid.slice(-4).toUpperCase()}`,
          deviceKeyHash,
          uid: pr.uid,
          status: "ACTIVE",
        });
      } else {
        device = (await storage.updateDevice(device.id, {
          shopId: shop.id,
          status: "ACTIVE",
        }))!;
      }

      await storage.claimPairRequest(pr.id, user.id, shop.id, device.id);

      let config = await storage.getDeviceConfig(shop.id);
      if (!config) {
        config = await storage.upsertDeviceConfig({ shopId: shop.id });
      }

      res.json({
        ok: true,
        deviceId: device.id,
        shopId: shop.id,
        shopName: shop.name,
      });
    } catch (error) {
      console.error("V2 pair-claim error:", error);
      res.status(500).json({ ok: false, error: "Pair claim failed" });
    }
  });

  // V2 Pair Status — ESP32 polls to check if paired
  app.get("/api/v2/device/pair-status", async (req, res) => {
    try {
      const uid = req.query.uid as string;
      if (!uid) {
        return res.status(400).json({ ok: false, error: "uid query param required" });
      }

      const device = await storage.getDeviceByUid(uid);
      if (device && device.shopId && device.status === "ACTIVE") {
        const config = await storage.getDeviceConfig(device.shopId);
        const shop = await storage.getShop(device.shopId);
        return res.json({
          ok: true,
          paired: true,
          deviceId: device.id,
          shopId: device.shopId,
          shopName: shop?.name ?? null,
          config: {
            sessionWindowSec: config?.sessionWindowSec ?? 60,
            acceptedHoldMs: config?.acceptedHoldMs ?? 6000,
            telemetryPeriodSec: 60,
            warnTempC: config?.warnTempC ?? 55,
            warnVocAnalog: config?.warnVocAnalog ?? 850,
            warnVocDigital: config?.warnUseVocDigital ? 1 : -1,
          },
        });
      }

      res.json({ ok: true, paired: false });
    } catch (error) {
      console.error("V2 pair-status error:", error);
      res.status(500).json({ ok: false, error: "Status check failed" });
    }
  });

  // V2 Config — ESP32 fetches cloud config
  app.get("/api/v2/device/config", async (req, res) => {
    try {
      const uid = req.query.uid as string;
      if (!uid) {
        return res.status(400).json({ ok: false, error: "uid query param required" });
      }

      const device = await storage.getDeviceByUid(uid);
      if (!device || !device.shopId) {
        return res.status(404).json({ ok: false, error: "Device not paired" });
      }

      await storage.updateDeviceLastSeen(device.id);

      const config = await storage.getDeviceConfig(device.shopId);
      const rewardConfig = await storage.getRewardConfig(device.shopId);

      res.json({
        ok: true,
        deviceId: device.id,
        shopId: device.shopId,
        config: {
          sessionWindowSec: config?.sessionWindowSec ?? 60,
          acceptedHoldMs: config?.acceptedHoldMs ?? 6000,
          telemetryPeriodSec: 60,
          warnTempC: config?.warnTempC ?? 55,
          warnVocAnalog: config?.warnVocAnalog ?? 850,
          warnVocDigital: config?.warnUseVocDigital ? 1 : -1,
        },
        rewards_enabled: rewardConfig?.enabled ?? true,
      });
    } catch (error) {
      console.error("V2 config error:", error);
      res.status(500).json({ ok: false, error: "Config fetch failed" });
    }
  });

  // V2 Drop — ESP32 reports a vape drop, creates/extends reward session
  app.post("/api/v2/device/drop", async (req, res) => {
    try {
      const { uid, event_id } = req.body;
      if (!uid) {
        return res.status(400).json({ ok: false, error: "uid required" });
      }

      const device = await storage.getDeviceByUid(uid);
      if (!device || !device.shopId || device.status !== "ACTIVE") {
        return res.status(400).json({ ok: false, error: "Device not paired or inactive" });
      }

      await storage.updateDeviceLastSeen(device.id);

      if (event_id) {
        const existing = await storage.getDropEventByDeviceEventId(event_id);
        if (existing) {
          const session = existing.sessionId ? await storage.getRewardSession(existing.sessionId) : null;
          return res.json({
            ok: true,
            duplicate: true,
            sessionId: session?.id ?? null,
            points: session?.pointsTotal ?? 0,
            qr_url: session ? `https://littr.co/app/claim?token=${session.token}` : null,
            stackCount: session?.dropCount ?? 0,
          });
        }
      }

      const config = await storage.getDeviceConfig(device.shopId);
      const sessionWindowSec = config?.sessionWindowSec ?? 60;

      const points = rollPointsV2();

      let session = await storage.getActiveRewardSession(device.id);

      if (session) {
        const newTotal = session.pointsTotal + points;
        const newCount = session.dropCount + 1;
        const newExpiry = new Date(Date.now() + sessionWindowSec * 1000);
        session = (await storage.updateRewardSession(session.id, {
          pointsTotal: newTotal,
          dropCount: newCount,
          lastDropAt: new Date(),
          expiresAt: newExpiry,
        }))!;
      } else {
        const token = generateClaimToken();
        const expiresAt = new Date(Date.now() + sessionWindowSec * 1000);
        session = await storage.createRewardSession({
          deviceId: device.id,
          shopId: device.shopId,
          token,
          pointsTotal: points,
          dropCount: 1,
          lastDropAt: new Date(),
          expiresAt,
        });
      }

      const dropEvent = await storage.createDropEvent({
        shopId: device.shopId,
        deviceId: device.id,
        deviceEventId: event_id || null,
        sessionId: session.id,
        pointsAwarded: points,
      });

      await storage.creditPartnerPoints({
        shopId: device.shopId,
        deviceId: device.id,
        points: 1,
        reason: "drop",
        dropEventId: dropEvent.id,
      });

      res.json({
        ok: true,
        sessionId: session.id,
        points: session.pointsTotal,
        qr_url: `https://littr.co/app/claim?token=${session.token}`,
        stackCount: session.dropCount,
      });
    } catch (error) {
      console.error("V2 drop error:", error);
      res.status(500).json({ ok: false, error: "Drop failed" });
    }
  });

  // V2 Session Claim — user scans QR to claim stacked session points
  app.post("/api/v2/claim", optionalAuthMiddleware, async (req, res) => {
    try {
      const sessionToken = req.body.token || req.body.sessionToken;
      const { email, password } = req.body;
      if (!sessionToken) {
        return res.status(400).json({ ok: false, error: "token required" });
      }

      const session = await storage.getRewardSessionByToken(sessionToken);
      if (!session) {
        return res.status(404).json({ ok: false, error: "Session not found" });
      }
      if (session.status === "CLAIMED") {
        return res.status(400).json({ ok: false, error: "Already claimed" });
      }
      if (session.status === "EXPIRED" || new Date(session.expiresAt) < new Date()) {
        if (session.status !== "EXPIRED") {
          await storage.updateRewardSession(session.id, { status: "EXPIRED" as any, voided: true });
        }
        return res.status(400).json({ ok: false, error: "Session expired" });
      }

      let user = req.user;
      let newSessionId: string | undefined;

      if (!user) {
        if (!email || !password) {
          return res.status(400).json({
            ok: false,
            error: "Please log in or register to claim points",
            requiresAuth: true,
          });
        }

        const existing = await storage.getUserByEmail(email);
        if (existing) {
          const result = await login(email, password);
          if (!result) {
            return res.status(401).json({ ok: false, error: "Invalid credentials" });
          }
          user = result.user;
          newSessionId = result.sessionId;
        } else {
          const result = await register(email, password, "CUSTOMER");
          user = result.user;
          newSessionId = result.sessionId;
        }
      }

      let customer = await storage.getCustomerByUserId(user!.id);
      if (!customer) {
        customer = await storage.createCustomer({ userId: user!.id, publicId: `LITTR-${Date.now().toString(36).toUpperCase()}` });
        await storage.createWallet(customer.id);
      }

      const wallet = await storage.getWallet(customer.id);
      if (!wallet) {
        return res.status(500).json({ ok: false, error: "Wallet error" });
      }

      await storage.updateWalletBalance(customer.id, session.pointsTotal, true);
      await storage.createTransaction({
        walletId: wallet.id,
        type: "EARN",
        amount: session.pointsTotal,
        description: `Claimed ${session.dropCount} drop(s) from recycling bin`,
      });

      await storage.updateRewardSession(session.id, {
        status: "CLAIMED" as any,
        claimedByUserId: user!.id,
        claimedAt: new Date(),
      });

      const updatedWallet = await storage.getWallet(customer.id);

      res.json({
        ok: true,
        pointsClaimed: session.pointsTotal,
        dropCount: session.dropCount,
        newBalance: updatedWallet?.pointsBalance ?? session.pointsTotal,
        ...(newSessionId ? { sessionId: newSessionId } : {}),
      });
    } catch (error) {
      console.error("V2 claim error:", error);
      res.status(500).json({ ok: false, error: "Claim failed" });
    }
  });

  // V2 Telemetry — ESP32 reports sensor data
  app.post("/api/v2/device/telemetry", async (req, res) => {
    try {
      const { uid } = req.body;
      const temperatureC = req.body.temperatureC ?? req.body.temperature;
      const vocAnalog = req.body.vocAnalog ?? req.body.voc_analog;
      const vocDigital = req.body.vocDigital ?? req.body.voc_digital;
      const fillPercent = req.body.fillPercent ?? req.body.fill_pct;

      if (!uid) {
        return res.status(400).json({ ok: false, error: "uid required" });
      }

      const device = await storage.getDeviceByUid(uid);
      if (!device || !device.shopId) {
        return res.status(404).json({ ok: false, error: "Device not paired" });
      }

      await storage.updateDeviceLastSeen(device.id);

      const bin = await storage.getBinByDeviceId(device.id);
      if (bin) {
        await storage.updateBinSensorData(bin.id, {
          lastTemperature: temperatureC,
          lastVocAnalog: vocAnalog,
          lastVocDigital: vocDigital,
          fillLevel: fillPercent,
        });

        await storage.createBinReading({
          binId: bin.id,
          temperature: temperatureC,
          vocAnalog: vocAnalog,
          vocDigital: vocDigital,
          fillLevel: fillPercent,
        });
      }

      const config = await storage.getDeviceConfig(device.shopId);
      const warnTempC = config?.warnTempC ?? 55;
      const warnVocAnalog = config?.warnVocAnalog ?? 850;
      const warnVocDigitalEnabled = config?.warnUseVocDigital ?? false;

      let fireAlertTriggered = false;

      if (temperatureC != null && temperatureC >= warnTempC) {
        fireAlertTriggered = true;
        const severity = temperatureC >= 80 ? "CRITICAL" : temperatureC >= 60 ? "HIGH" : "MEDIUM";
        if (bin) {
          await storage.createFireAlert({
            binId: bin.id,
            shopId: device.shopId,
            severity: severity as any,
            temperature: temperatureC,
            temperatureRise: temperatureC > 60 ? temperatureC - 60 : 0,
          });
        }
      }

      if (vocAnalog != null && vocAnalog >= warnVocAnalog) {
        fireAlertTriggered = true;
        if (bin) {
          await storage.createFireAlert({
            binId: bin.id,
            shopId: device.shopId,
            severity: "HIGH" as any,
            temperature: temperatureC ?? 0,
            temperatureRise: 0,
          });
        }
      }

      if (warnVocDigitalEnabled && vocDigital === true) {
        fireAlertTriggered = true;
        if (bin) {
          await storage.createFireAlert({
            binId: bin.id,
            shopId: device.shopId,
            severity: "HIGH" as any,
            temperature: temperatureC ?? 0,
            temperatureRise: 0,
          });
        }
      }

      res.json({ status: "ok", fireAlertTriggered });
    } catch (error) {
      console.error("V2 telemetry error:", error);
      res.status(500).json({ ok: false, error: "Telemetry failed" });
    }
  });

  // V2 Staff/Partner — Update device config for a shop
  app.patch("/api/v2/shop/:shopId/device-config", authMiddleware, async (req, res) => {
    try {
      const user = req.user!;
      const shopId = parseInt(req.params.shopId);

      if (user.role === "PARTNER") {
        const memberShops = await storage.getShopsByMemberId(user.id);
        if (!memberShops.find(s => s.id === shopId)) {
          return res.status(403).json({ ok: false, error: "Not a member of this shop" });
        }
      } else if (user.role !== "STAFF") {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }

      const { session_window_sec, accepted_hold_ms, warn_enabled, warn_temp_c, warn_voc_analog, warn_use_voc_digital, raw_swap_bytes } = req.body;
      const updateData: any = {};
      if (session_window_sec !== undefined) updateData.sessionWindowSec = session_window_sec;
      if (accepted_hold_ms !== undefined) updateData.acceptedHoldMs = accepted_hold_ms;
      if (warn_enabled !== undefined) updateData.warnEnabled = warn_enabled;
      if (warn_temp_c !== undefined) updateData.warnTempC = warn_temp_c;
      if (warn_voc_analog !== undefined) updateData.warnVocAnalog = warn_voc_analog;
      if (warn_use_voc_digital !== undefined) updateData.warnUseVocDigital = warn_use_voc_digital;
      if (raw_swap_bytes !== undefined) updateData.rawSwapBytes = raw_swap_bytes;

      let config = await storage.getDeviceConfig(shopId);
      if (!config) {
        config = await storage.upsertDeviceConfig({ shopId, ...updateData });
      } else {
        config = (await storage.updateDeviceConfig(shopId, updateData))!;
      }

      res.json({ ok: true, config });
    } catch (error) {
      console.error("V2 device-config update error:", error);
      res.status(500).json({ ok: false, error: "Config update failed" });
    }
  });

  // V2 Staff/Partner — Get device config for a shop
  app.get("/api/v2/shop/:shopId/device-config", authMiddleware, async (req, res) => {
    try {
      const user = req.user!;
      const shopId = parseInt(req.params.shopId);

      if (user.role === "PARTNER") {
        const memberShops = await storage.getShopsByMemberId(user.id);
        if (!memberShops.find(s => s.id === shopId)) {
          return res.status(403).json({ ok: false, error: "Not a member of this shop" });
        }
      } else if (user.role !== "STAFF") {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }

      let config = await storage.getDeviceConfig(shopId);
      if (!config) {
        config = await storage.upsertDeviceConfig({ shopId });
      }

      res.json({ ok: true, config });
    } catch (error) {
      console.error("V2 get device-config error:", error);
      res.status(500).json({ ok: false, error: "Config fetch failed" });
    }
  });

  // V2 Partner Points Ledger
  app.get("/api/v2/shop/:shopId/points-ledger", authMiddleware, async (req, res) => {
    try {
      const user = req.user!;
      const shopId = parseInt(req.params.shopId);

      if (user.role === "PARTNER") {
        const memberShops = await storage.getShopsByMemberId(user.id);
        if (!memberShops.find(s => s.id === shopId)) {
          return res.status(403).json({ ok: false, error: "Not a member of this shop" });
        }
      } else if (user.role !== "STAFF") {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }

      const [ledger, total] = await Promise.all([
        storage.getPartnerPointsLedger(shopId),
        storage.getPartnerPointsTotal(shopId),
      ]);

      res.json({ ok: true, total, entries: ledger });
    } catch (error) {
      console.error("V2 points-ledger error:", error);
      res.status(500).json({ ok: false, error: "Ledger fetch failed" });
    }
  });

  // V2 Staff — list all pair requests
  app.get("/api/v2/staff/pair-requests", authMiddleware, requireRole("STAFF"), async (req, res) => {
    try {
      const requests = await storage.getAllPairRequests();
      res.json(requests);
    } catch (error) {
      console.error("V2 staff pair-requests error:", error);
      res.status(500).json({ error: "Failed to fetch pair requests" });
    }
  });

  // Background job: void expired unclaimed sessions every 30 seconds
  setInterval(async () => {
    try {
      const count = await storage.expireOldSessions();
      if (count > 0) {
        console.log(`[cleanup] Voided ${count} expired unclaimed session(s)`);
      }
    } catch (error) {
      console.error("[cleanup] Session expiry error:", error);
    }
  }, 30_000);

  return httpServer;
}
