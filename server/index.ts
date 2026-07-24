import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { startOfflineSweep } from "./notify";
import { serveStatic } from "./static";
import { storageDriver } from "./blobstore";
import { createServer } from "http";

const app = express();
// Behind the platform reverse proxy (Replit), the socket peer is the proxy, so
// req.ip must derive from X-Forwarded-For for the IP-keyed rate limiters
// (auth/claim/claim-by-code, spec §2.7) to key on the real client instead of
// collapsing to one global bucket. Pin the hop count to the number of trusted
// proxies (1) — not `true` — so clients cannot spoof X-Forwarded-For to evade them.
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "20mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "20mb" }));

// How stored objects are read back is the StorageDriver's call (§D2). The
// default local-disk driver returns the same `/uploads` express.static mount
// this used to hardcode; a bucket driver returns null because its objects are
// served by the bucket/CDN at the absolute URLs it handed out at write time.
const uploadsMount = storageDriver.staticMount();
if (uploadsMount) app.use(uploadsMount.path, uploadsMount.handler);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let line = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const s = JSON.stringify(capturedJsonResponse);
        line += ` :: ${s.length > 200 ? s.slice(0, 200) + "..." : s}`;
      }
      log(line);
    }
  });
  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  startOfflineSweep();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  // reusePort is unsupported on Windows (listen throws ENOTSUP); it's only needed on
  // the Linux hosting platform, so enable it everywhere except win32.
  const listenOpts: { port: number; host: string; reusePort?: boolean } = {
    port,
    host: "0.0.0.0",
    ...(process.platform === "win32" ? {} : { reusePort: true }),
  };
  httpServer.listen(listenOpts, () => {
    log(`serving on port ${port}`);
  });
})();
