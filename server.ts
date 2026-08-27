import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/** Minimal structured stdout logger (ESLint no-console permits only warn/error). */
const logInfo = (...parts: unknown[]): void => {
  process.stdout.write(`[invoiceflow] ${new Date().toISOString()} ${parts.join(" ")}\n`);
};

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Firebase configuration missing! Check your environment variables.");
  process.exit(1);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "InvoiceFlow AI API is running" });
  });

  // Background Worker for Recurring Invoices & Reminders
  // NOTE: In production, this should run as a Cloud Function / Cloud Scheduler job
  // with proper authentication context. Running here only for local development.
  const processAutomations = async () => {
    logInfo("[Worker] Start automation cycle");

    // SECURITY: In production, use Cloud Functions with proper auth.
    // This dev version only logs - actual processing should be user-triggered or via scheduled functions.
    logInfo("[Worker] Development mode - automation logic runs via Cloud Functions in production");
  };
  
  // Only run worker in development for logging purposes
  if (process.env.NODE_ENV !== "production") {
    setInterval(processAutomations, 3600000);
    processAutomations();
  }

  app.post("/api/generate-invoice", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    try {
      // In a real full-stack app, we'd use GEMINI_API_KEY from process.env
      // but the guidelines say Gemini calls MUST happen in the frontend for React.
      // However, for sensitive prompt engineering and parsing, we might want it here.
      // BUT, since the guidelines are strict: "Always call Gemini API from the frontend code of the application. NEVER call Gemini API from the backend."
      // I will implement the AI service purely in the frontend React code.
      // I will return a success message here acknowledging the request.
      res.json({ message: "Server ready to receive AI data" });
    } catch {
      res.status(500).json({ error: "Failed to process AI request" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logInfo(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
