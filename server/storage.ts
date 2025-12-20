import { 
  type User, 
  type InsertUser,
  type Contact,
  type InsertContact,
  type BinRequest,
  type InsertBinRequest,
  type Volunteer,
  type InsertVolunteer,
  users,
  contacts,
  binRequests,
  volunteers,
} from "@shared/schema";
import { db } from "./db";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Contacts
  createContact(contact: InsertContact): Promise<Contact>;
  getAllContacts(): Promise<Contact[]>;
  
  // Bin Requests
  createBinRequest(request: InsertBinRequest): Promise<BinRequest>;
  getAllBinRequests(): Promise<BinRequest[]>;
  
  // Volunteers
  createVolunteer(volunteer: InsertVolunteer): Promise<Volunteer>;
  getAllVolunteers(): Promise<Volunteer[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Contacts
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async getAllContacts(): Promise<Contact[]> {
    return await db.select().from(contacts).orderBy(desc(contacts.createdAt));
  }

  // Bin Requests
  async createBinRequest(insertBinRequest: InsertBinRequest): Promise<BinRequest> {
    const [request] = await db.insert(binRequests).values(insertBinRequest).returning();
    return request;
  }

  async getAllBinRequests(): Promise<BinRequest[]> {
    return await db.select().from(binRequests).orderBy(desc(binRequests.createdAt));
  }

  // Volunteers
  async createVolunteer(insertVolunteer: InsertVolunteer): Promise<Volunteer> {
    const [volunteer] = await db.insert(volunteers).values(insertVolunteer).returning();
    return volunteer;
  }

  async getAllVolunteers(): Promise<Volunteer[]> {
    return await db.select().from(volunteers).orderBy(desc(volunteers.createdAt));
  }
}

export const storage = new DatabaseStorage();
