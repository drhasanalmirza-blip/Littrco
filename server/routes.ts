import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertBinRequestSchema, insertVolunteerSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Contact form submission
  app.post("/api/contact", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(data);
      res.json(contact);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  // Bin request submission
  app.post("/api/bin-request", async (req, res) => {
    try {
      const data = insertBinRequestSchema.parse(req.body);
      const request = await storage.createBinRequest(data);
      res.json(request);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create bin request" });
    }
  });

  // Volunteer application submission
  app.post("/api/volunteer", async (req, res) => {
    try {
      const data = insertVolunteerSchema.parse(req.body);
      const volunteer = await storage.createVolunteer(data);
      res.json(volunteer);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: "Failed to create volunteer application" });
    }
  });

  // Dashboard data endpoints
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
      const requests = await storage.getAllBinRequests();
      res.json(requests);
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

  return httpServer;
}
