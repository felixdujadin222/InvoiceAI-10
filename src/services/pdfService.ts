import jsPDFModule from 'jspdf';
import type { jsPDF } from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';
import type { InvoiceItem } from './geminiService';

// jsPDF ships CJS and ESM builds with different interop shapes; resolve the
// constructor defensively so this module also works outside the Vite browser
// bundle (e.g. `npx tsx scripts/pdf-smoke.ts`).
const jspdfMod = jsPDFModule as unknown as { jsPDF?: typeof jsPDF; default?: typeof jsPDF };
const JsPDF = jspdfMod.jsPDF ?? jspdfMod.default ?? jsPDFModule;


export interface PDFInvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  currency: string;
  businessName?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  logoUrl?: string;
  terms?: string;
  status?: string;
  notes?: string;
  paymentMethod?: string;
  clientPhone?: string;
  clientAddress?: string;
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    swiftCode?: string;
    iban?: string;
  };
}

// ----------------------------------------------------
// Shared palette (mirrors the app's Tailwind slate/blue tokens)
// ----------------------------------------------------
type RGB = [number, number, number];
const C = {
  brand: [37, 99, 235] as RGB,   // blue-600
  ink: [15, 23, 42] as RGB,      // slate-900
  body: [71, 85, 105] as RGB,    // slate-600
  muted: [100, 116, 139] as RGB, // slate-500
  faint: [148, 163, 184] as RGB, // slate-400
  line: [226, 232, 240] as RGB,  // slate-200
  wash: [248, 250, 252] as RGB,  // slate-50
  danger: [220, 38, 38] as RGB,  // red-600
  success: [22, 163, 74] as RGB, // green-600
  white: [255, 255, 255] as RGB,
};

/**
 * Builds the invoice document. Kept separate from save/preview so the layout
 * can be smoke-tested in Node: `npx tsx scripts/pdf-smoke.ts`.
 */
export const buildInvoicePdf = (data: PDFInvoiceData): jsPDF => {
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const M = 14; // page margin (mm)
  const RIGHT = pageWidth - M;

  const symbols: Record<string, string> = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'NGN': '₦', 'KES': 'KSh ' };
  const sym = symbols[(data.currency || '').toUpperCase()] || '$';
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency || 'USD' }).format(n || 0);
    } catch {
      return `${sym}${(n || 0).toLocaleString()}`;
    }
  };

  // ---- Brand accent band --------------------------------------------------
  doc.setFillColor(...C.brand);
  doc.rect(0, 0, pageWidth, 3.5, 'F');

  // ---- Header: business identity (left) / title block (right) -------------
  const logoSize = 16;
  let brandX = M;
  if (data.logoUrl) {
    try {
      doc.addImage(data.logoUrl, 'PNG', M, 11, logoSize, logoSize);
      brandX = M + logoSize + 5;
    } catch (e) {
      console.warn('PDF Logo failed to load', e);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C.ink);
  doc.text(data.businessName || 'InvoiceFlow AI', brandX, 18.5, { maxWidth: 92 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  const contactLines = [data.businessEmail, data.businessPhone, data.businessAddress]
    .filter(Boolean) as string[];
  contactLines.forEach((line, i) => doc.text(line, brandX, 23.5 + i * 4.2, { maxWidth: 92 }));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(23);
  doc.setTextColor(...C.ink);
  doc.text('INVOICE', RIGHT, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.muted);
  doc.text(`#${data.invoiceNumber}`, RIGHT, 26, { align: 'right' });

  // Status pill
  const status = (data.status || '').toLowerCase();
  const pillColors: Record<string, RGB> = {
    paid: C.success,
    overdue: C.danger,
    sent: C.brand,
    draft: C.faint,
  };
  if (status && pillColors[status]) {
    const label = status.toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const pw = doc.getTextWidth(label) + 8;
    const ph = 5.4;
    const px = RIGHT - pw;
    doc.setFillColor(...pillColors[status]);
    doc.roundedRect(px, 30, pw, ph, 2.7, 2.7, 'F');
    doc.setTextColor(...C.white);
    doc.text(label, px + pw / 2, 30 + ph / 2 + 1.1, { align: 'center' });
  }

  // ---- Meta panel (right) ---------------------------------------------------
  const metaRows: [string, string][] = [
    ['Date Issued', data.date],
    ['Due Date', data.dueDate],
  ];
  const metaW = 66;
  const metaX = RIGHT - metaW;
  const metaY = 42;
  const metaRowH = 7.4;
  const metaH = metaRows.length * metaRowH + 3.5;
  doc.setFillColor(...C.wash);
  doc.setDrawColor(...C.line);
  doc.roundedRect(metaX, metaY, metaW, metaH, 2.5, 2.5, 'FD');
  metaRows.forEach(([label, value], i) => {
    const yy = metaY + 6.6 + i * metaRowH;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.muted);
    doc.text(label, metaX + 4, yy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.ink);
    doc.text(value, metaX + metaW - 4, yy, { align: 'right' });
  });

  // ---- Bill To (left) --------------------------------------------------------
  const billY = metaY + 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.faint);
  doc.text('BILL TO', M, billY + 2.5, { charSpace: 0.6 });

  doc.setFontSize(12.5);
  doc.setTextColor(...C.ink);
  doc.text(data.clientName || '-', M, billY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  const clientLines = [data.clientEmail, data.clientPhone, data.clientAddress]
    .filter(Boolean) as string[];
  clientLines.forEach((line, i) => doc.text(line, M, billY + 15.5 + i * 4.6, { maxWidth: 95 }));

  // ---- Items table -----------------------------------------------------------
  const tableStart = Math.max(metaY + metaH, billY + 18 + clientLines.length * 4.6) + 9;
  const autoTableOptions: UserOptions = {
    startY: tableStart,
    margin: { left: M, right: M, top: 16, bottom: 20 },
    head: [['Description', 'Qty', 'Rate', 'Tax', 'Amount']],
    body: (data.items || []).map(item => [
      item.description || '-',
      String(item.quantity ?? 0),
      fmt(item.rate ?? 0),
      `${item.taxRate ?? 0}%`,
      fmt(item.amount ?? 0),
    ]),
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
      lineColor: C.line,
      lineWidth: 0.15,
      textColor: C.body,
      valign: 'middle',
    },
    headStyles: {
      fillColor: C.ink,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 9,
      lineColor: C.ink,
    },
    alternateRowStyles: { fillColor: C.wash },
    columnStyles: {
      0: { cellWidth: 'auto', textColor: C.ink },
      1: { halign: 'center', cellWidth: 16 },
      2: { halign: 'right', cellWidth: 26 },
      3: { halign: 'right', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 30, fontStyle: 'bold', textColor: C.ink },
    },
  };
  autoTable(doc, autoTableOptions);

  type WithAutoTable = jsPDF & { lastAutoTable?: { finalY?: number } };
  const finalY = (doc as WithAutoTable).lastAutoTable?.finalY ?? tableStart;

  // ---- Totals (right column) -------------------------------------------------
  const labelX = RIGHT - 56;
  let y = finalY + 9;
  const totalRow = (label: string, value: string, color: RGB = C.body, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...color);
    doc.text(label, labelX, y);
    doc.text(value, RIGHT, y, { align: 'right' });
  };

  totalRow('Subtotal', fmt(data.subtotal));
  y += 6.5;
  if (data.discount && data.discount > 0) {
    totalRow('Discount', `-${fmt(data.discount)}`, C.danger);
    y += 6.5;
  }
  totalRow('Tax', fmt(data.tax));
  y += 4.5;

  // Emphasized total band
  doc.setFillColor(...C.ink);
  doc.roundedRect(labelX - 6, y, RIGHT - labelX + 6, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text('Total', labelX, y + 7.2);
  doc.setFontSize(12.5);
  doc.text(fmt(data.total), RIGHT - 4, y + 7.4, { align: 'right' });

  // ---- Left column: notes / payment / terms -----------------------------------
  let leftY = finalY + 10;
  const sectionLabel = (text: string, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.faint);
    doc.text(text, M, yy, { charSpace: 0.5 });
  };

  if (data.notes) {
    sectionLabel('NOTES', leftY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.body);
    const noteLines: string[] = doc.splitTextToSize(data.notes, 92);
    doc.text(noteLines, M, leftY + 5);
    leftY += 9 + noteLines.length * 4.4;
  }

  if (data.paymentMethod) {
    sectionLabel('PAYMENT METHOD', leftY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.body);
    doc.text(data.paymentMethod, M, leftY + 5);
    leftY += 13;
  }

  const bd = data.bankDetails;
  if (bd && bd.bankName) {
    sectionLabel('PAYMENT DETAILS', leftY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.body);
    const bdLines = [
      `Bank: ${bd.bankName}`,
      bd.accountName ? `Account Name: ${bd.accountName}` : '',
      bd.accountNumber ? `Account Number: ${bd.accountNumber}` : '',
      bd.iban ? `IBAN: ${bd.iban}` : '',
      bd.swiftCode ? `SWIFT/BIC: ${bd.swiftCode}` : '',
    ].filter(Boolean) as string[];
    doc.text(bdLines, M, leftY + 5);
    leftY += 9 + bdLines.length * 4.2;
  }

  if (data.terms) {
    sectionLabel('TERMS & CONDITIONS', leftY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    const termLines: string[] = doc.splitTextToSize(data.terms, 92);
    doc.text(termLines, M, leftY + 5);
  }

  // ---- Footer on every page ----------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.line(M, pageHeight - 12, RIGHT, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.faint);
    doc.text(
      [data.businessName || 'InvoiceFlow AI', data.businessEmail].filter(Boolean).join('  ·  '),
      M,
      pageHeight - 7.5
    );
    doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 7.5, { align: 'center' });
    doc.text(`Page ${p} of ${pageCount}`, RIGHT, pageHeight - 7.5, { align: 'right' });
  }

  return doc;
};

export const generateInvoicePDF = (data: PDFInvoiceData, mode: 'download' | 'preview' = 'download') => {
  const doc = buildInvoicePdf(data);
  if (mode === 'preview') {
    return doc.output('bloburl');
  }
  doc.save(`Invoice_${data.invoiceNumber}.pdf`);
  return null;
};
