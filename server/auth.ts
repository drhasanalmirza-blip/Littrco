import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const SALT_ROUNDS = 10;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generatePublicId(): string {
  return `LITTR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function hashDeviceKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateDeviceKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateClaimToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Session-based auth middleware
declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers["x-session-id"] as string || req.cookies?.sessionId;
  
  if (!sessionId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const session = await storage.getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: "Session expired" });
  }
  
  const user = await storage.getUser(session.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  
  req.user = user;
  req.sessionId = sessionId;
  next();
}

// Optional auth - doesn't require auth but attaches user if present
export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers["x-session-id"] as string || req.cookies?.sessionId;
  
  if (sessionId) {
    const session = await storage.getSession(sessionId);
    if (session) {
      const user = await storage.getUser(session.userId);
      if (user) {
        req.user = user;
        req.sessionId = sessionId;
      }
    }
  }
  
  next();
}

// Role-based auth
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    next();
  };
}

// Login handler
export async function login(email: string, password: string): Promise<{ user: User; sessionId: string } | null> {
  const user = await storage.getUserByEmail(email);
  if (!user || !user.passwordHash) {
    return null;
  }
  
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }
  
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await storage.createSession(user.id, expiresAt);
  
  return { user, sessionId: session.id };
}

// Special staff email that auto-assigns STAFF role
const STAFF_EMAIL = "dr.hasanalmirza@gmail.com";

// Register handler
export async function register(email: string, password: string, role: "STAFF" | "PARTNER" | "CUSTOMER" = "CUSTOMER"): Promise<{ user: User; sessionId: string }> {
  const passwordHash = await hashPassword(password);
  
  // Auto-assign STAFF role for special email
  const actualRole = email.toLowerCase() === STAFF_EMAIL.toLowerCase() ? "STAFF" : role;
  
  const user = await storage.createUser({ email, passwordHash, role: actualRole });
  
  // Create customer profile + wallet if customer
  if (actualRole === "CUSTOMER") {
    const publicId = generatePublicId();
    const customer = await storage.createCustomer({ userId: user.id, publicId });
    await storage.createWallet(customer.id);
  }
  
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await storage.createSession(user.id, expiresAt);
  
  return { user, sessionId: session.id };
}

// Logout handler
export async function logout(sessionId: string): Promise<void> {
  await storage.deleteSession(sessionId);
}

// Device authentication for ESP32
export async function authenticateDevice(deviceId: string, deviceKey: string): Promise<{ device: any; shop: any } | null> {
  const device = await storage.getDevice(parseInt(deviceId));
  if (!device) {
    return null;
  }
  
  const keyHash = hashDeviceKey(deviceKey);
  if (keyHash !== device.deviceKeyHash) {
    return null;
  }
  
  if (device.status !== "ACTIVE") {
    return null;
  }
  
  const shop = await storage.getShop(device.shopId);
  if (!shop || shop.status !== "VERIFIED") {
    return null;
  }
  
  // Update last seen
  await storage.updateDeviceLastSeen(device.id);
  
  return { device, shop };
}
