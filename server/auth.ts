import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User, Device } from "@shared/schema";

const SALT_ROUNDS = 10;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

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

export function generateSerial(): string {
  return `BIN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function generateClaimToken(): string {
  return crypto.randomBytes(20).toString("hex");
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
      device?: Device;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = (req.headers["x-session-id"] as string) || (req as any).cookies?.sessionId;
  if (!sessionId) return res.status(401).json({ error: "Unauthorized" });
  const session = await storage.getSession(sessionId);
  if (!session) return res.status(401).json({ error: "Session expired" });
  const user = await storage.getUser(session.userId);
  if (!user) return res.status(401).json({ error: "User not found" });
  req.user = user;
  req.sessionId = sessionId;
  next();
}

export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = (req.headers["x-session-id"] as string) || (req as any).cookies?.sessionId;
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

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

// Device key auth — for ESP32 → server calls
export async function deviceAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-device-key"] as string;
  if (!key) return res.status(401).json({ error: "Missing X-Device-Key" });
  const hash = hashDeviceKey(key);
  const device = await storage.getDeviceByKeyHash(hash);
  if (!device) return res.status(401).json({ error: "Invalid device key" });
  if (device.status === "RETIRED") return res.status(403).json({ error: "Device retired" });
  req.device = device;
  next();
}

export async function login(email: string, password: string) {
  const user = await storage.getUserByEmail(email);
  if (!user || !user.passwordHash) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await storage.createSession(user.id, expiresAt);
  return { user, sessionId: session.id };
}

const STAFF_EMAIL = "dr.hasanalmirza@gmail.com";

export async function register(email: string, password: string, role: "STAFF" | "PARTNER" | "CUSTOMER" = "CUSTOMER") {
  const passwordHash = await hashPassword(password);
  const actualRole = email.toLowerCase() === STAFF_EMAIL.toLowerCase() ? "STAFF" : role;
  const user = await storage.createUser({ email, passwordHash, role: actualRole });
  if (actualRole === "CUSTOMER") {
    const publicId = generatePublicId();
    const customer = await storage.createCustomer({ userId: user.id, publicId });
    await storage.createWallet(customer.id);
  }
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await storage.createSession(user.id, expiresAt);
  return { user, sessionId: session.id };
}

export async function logout(sessionId: string): Promise<void> {
  await storage.deleteSession(sessionId);
}
