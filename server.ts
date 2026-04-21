import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc,
  query, 
  where, 
  doc, 
  updateDoc, 
  serverTimestamp,
  collectionGroup
} from "firebase/firestore/lite";
import { differenceInDays } from "date-fns";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "InvoiceFlow AI API is running" });
  });

  // Background Worker for Recurring Invoices & Reminders
  const processAutomations = async () => {
    console.log("[Worker] Start automation cycle at", new Date().toISOString());
    const today = new Date();
    
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        console.log(`[Worker] Checking automations for user: ${userId}`);

        // --- 1. PROCESS RECURRING INVOICES ---
        const recurringRef = collection(db, `users/${userId}/recurring`);
        const recurringQuery = query(recurringRef, where("active", "==", true));
        const recurringSnap = await getDocs(recurringQuery);

        for (const recDoc of recurringSnap.docs) {
          const recData = { id: recDoc.id, ...recDoc.data() } as any;
          const nextRun = new Date(recData.nextRunDate);

          if (nextRun <= today) {
            console.log(`[Worker] Generating recurring invoice for user ${userId}, client ${recData.clientName}`);
            
            // Create New Invoice
            const invoiceRef = collection(db, `users/${userId}/invoices`);
            const invoiceNumber = `INV-REC-${Date.now().toString().slice(-6)}`;
            
            // Set due date to 7 days from now by default
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);

            await addDoc(invoiceRef, {
              userId,
              clientId: recData.clientId,
              clientName: recData.clientName,
              invoiceNumber,
              status: "sent",
              items: recData.items || [],
              subtotal: recData.total,
              tax: 0,
              total: recData.total,
              dueDate: dueDate.toISOString(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            // Calculate Next Run Date
            const newNextRun = new Date(nextRun);
            if (recData.frequency === 'weekly') newNextRun.setDate(newNextRun.getDate() + 7);
            else if (recData.frequency === 'monthly') newNextRun.setMonth(newNextRun.getMonth() + 1);
            else newNextRun.setDate(newNextRun.getDate() + (recData.interval || 30));

            await updateDoc(doc(db, `users/${userId}/recurring`, recData.id), {
              nextRunDate: newNextRun.toISOString(),
              lastRunDate: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }

        // --- 2. UPDATE OVERDUE STATUS ---
        const invoicesRef = collection(db, `users/${userId}/invoices`);
        const sentInvoicesQuery = query(invoicesRef, where("status", "==", "sent"));
        const sentSnap = await getDocs(sentInvoicesQuery);

        for (const invDoc of sentSnap.docs) {
          const inv = invDoc.data();
          if (inv.dueDate && new Date(inv.dueDate) < today) {
            await updateDoc(doc(db, `users/${userId}/invoices`, invDoc.id), {
              status: "overdue",
              updatedAt: serverTimestamp()
            });
            console.log(`[Worker] Marked invoice ${invDoc.id} as OVERDUE`);
          }
        }
      }
    } catch (error) {
      console.error("[Worker] Automation error:", error);
    }
  };
  
  // Run every hour in development (simulated)
  setInterval(processAutomations, 3600000);
  // Trigger once on start for logs
  processAutomations();

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
    } catch (error) {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
