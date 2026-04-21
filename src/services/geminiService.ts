import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number; // New field for per-item tax
}

export interface GeneratedInvoice {
  clientName: string;
  items: InvoiceItem[];
  notes?: string;
  suggestedTaxRate?: number; // Global fallback tax rate
}

export async function parseInvoiceDescription(description: string): Promise<GeneratedInvoice> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert billing specialist. Parse the following description into a professional, structured invoice format.
    
    CRITICAL INSTRUCTIONS:
    - Extract the client name accurately.
    - BREAK DOWN work into detailed, specific line items.
    - TAX SCENARIOS: 
      - Identify if specific items have different tax rates or are tax-exempt.
      - If an item is tax-exempt, set its taxRate to 0.
      - Assign a taxRate (percentage, e.g., 15 for 15%) to each line item based on the description or industry standards.
    - SUGGEST reasonable industry standard rates if they are missing.
    - NOTES: Mention if any specific tax rules were applied (e.g., VAT exemptions).

    User Input Job Description: "${description}"
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          clientName: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                rate: { type: Type.NUMBER },
                amount: { type: Type.NUMBER },
                taxRate: { type: Type.NUMBER }
              },
              required: ["description", "quantity", "rate", "amount"]
            }
          },
          notes: { type: Type.STRING },
          suggestedTaxRate: { type: Type.NUMBER }
        },
        required: ["clientName", "items"]
      }
    }
  });

  return JSON.parse(response.text);
}

export interface ReceiptInfo {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  currency: string;
}

export async function parseReceipt(file: File): Promise<ReceiptInfo> {
  // Convert File to base64
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  const model = "gemini-3-flash-preview";
  const prompt = "Extract the merchant name, total amount, date, category (General, Travel, Food, Software, hardware, Marketing, Taxes, Office), and currency from this receipt image.";

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: file.type } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          merchant: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          date: { type: Type.STRING, description: "ISO format yyyy-mm-dd" },
          category: { type: Type.STRING },
          currency: { type: Type.STRING }
        },
        required: ["merchant", "amount", "date", "category", "currency"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function getFinancialInsights(invoices: any[], expenses: any[]): Promise<string> {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Analyze this financial data for a freelancer/small business:
    Invoices: ${JSON.stringify(invoices.map(i => ({ total: i.total, status: i.status, date: i.createdAt })))}
    Expenses: ${JSON.stringify(expenses.map(e => ({ amount: e.amount, category: e.category, date: e.date })))}
    
    Provide a concise, 2-3 sentence strategic growth tip.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { systemInstruction: "You are a senior business growth consultant. Be professional and encouraging." }
  });

  return response.text || "Continue tracking your financials to see personalized insights.";
}
