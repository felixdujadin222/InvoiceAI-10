import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

interface PDFInvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  items: any[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  currency: string;
  businessName?: string;
  businessEmail?: string;
  logoUrl?: string;
  terms?: string;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    swiftCode?: string;
    iban?: string;
  };
}

export const generateInvoicePDF = (data: PDFInvoiceData, mode: 'download' | 'preview' = 'download') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const currencySymbol = (code: string) => {
    const symbols: Record<string, string> = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'NGN': '₦', 'KES': 'KSh' };
    return symbols[code] || '$';
  };
  const sym = currencySymbol(data.currency);

  // Logo Handling
  if (data.logoUrl) {
    try {
      doc.addImage(data.logoUrl, 'PNG', 20, 15, 20, 20);
    } catch (e) {
      console.warn("PDF Logo failed to load", e);
    }
  }

  // Branding
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235); // blue-600
  doc.text(data.businessName || 'InvoiceFlow AI', data.logoUrl ? 45 : 20, 25);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(data.businessEmail || '', data.logoUrl ? 45 : 20, 32);

  // Invoice Label
  doc.setFontSize(32);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('INVOICE', pageWidth - 20, 35, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`#${data.invoiceNumber}`, pageWidth - 20, 42, { align: 'right' });

  // Client Details
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Bill To:', 20, 60);
  doc.setFontSize(14);
  doc.text(data.clientName, 20, 68);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(data.clientEmail, 20, 74);

  // Invoice Meta
  doc.text('Date Issued:', pageWidth - 80, 60);
  doc.text('Due Date:', pageWidth - 80, 70);
  
  doc.setTextColor(30, 41, 59);
  doc.text(data.date, pageWidth - 20, 60, { align: 'right' });
  doc.text(data.dueDate, pageWidth - 20, 70, { align: 'right' });

  // Items Table
  (doc as any).autoTable({
    startY: 90,
    head: [['Description', 'Qty', 'Rate', 'Tax %', 'Amount']],
    body: data.items.map(item => [
      item.description,
      item.quantity,
      `${sym}${item.rate.toLocaleString()}`,
      `${item.taxRate !== undefined ? item.taxRate : '5'}%`,
      `${sym}${item.amount.toLocaleString()}`
    ]),
    headStyles: { 
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold'
    },
    styles: { 
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 15 },
      2: { halign: 'right', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 30 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totals
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', pageWidth - 80, finalY);
  
  let currentY = finalY;
  doc.text(`${sym}${data.subtotal.toLocaleString()}`, pageWidth - 20, currentY, { align: 'right' });

  if (data.discount && data.discount > 0) {
    currentY += 7;
    doc.setTextColor(239, 68, 68); // red-500
    doc.text('Discount:', pageWidth - 80, currentY);
    doc.text(`-${sym}${data.discount.toLocaleString()}`, pageWidth - 20, currentY, { align: 'right' });
    doc.setTextColor(100, 116, 139);
  }

  currentY += 7;
  doc.text('Tax:', pageWidth - 80, currentY);
  doc.text(`${sym}${data.tax.toLocaleString()}`, pageWidth - 20, currentY, { align: 'right' });

  currentY += 10;
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Total Amount:', pageWidth - 80, currentY);
  
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text(`${sym}${data.total.toLocaleString()}`, pageWidth - 20, currentY, { align: 'right' });

  // Notes / Bank Details
  let leftColY = currentY + 25;
  if (data.bankDetails && data.bankDetails.bankName) {
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Payment Instructions:', 20, leftColY);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    leftColY += 6;
    doc.text(`Bank: ${data.bankDetails.bankName}`, 20, leftColY);
    leftColY += 4;
    doc.text(`A/C Name: ${data.bankDetails.accountName}`, 20, leftColY);
    leftColY += 4;
    doc.text(`A/C Number: ${data.bankDetails.accountNumber}`, 20, leftColY);
    
    if (data.bankDetails.iban) {
      leftColY += 4;
      doc.text(`IBAN: ${data.bankDetails.iban}`, 20, leftColY);
    }
    if (data.bankDetails.swiftCode) {
      leftColY += 4;
      doc.text(`SWIFT/BIC: ${data.bankDetails.swiftCode}`, 20, leftColY);
    }
    leftColY += 12;
  }

  // Terms
  if (data.terms) {
    const termsY = leftColY;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Terms & Conditions:', 20, termsY);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const splitTerms = doc.splitTextToSize(data.terms, 100);
    doc.text(splitTerms, 20, termsY + 6);
  }

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Thank you for your business!', pageWidth / 2, 280, { align: 'center' });

  if (mode === 'preview') {
    return doc.output('bloburl');
  }

  doc.save(`Invoice_${data.invoiceNumber}.pdf`);
  return null;
};
