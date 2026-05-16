import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatDate, formatDateTime, isValidDate } from './utils';

export interface BusinessInfo {
  name: string;
  phone?: string;
  address?: string;
  email?: string;
}

export interface CustomerInfo {
  name: string;
  phone?: string;
  address?: string;
  shopName?: string;
}

export interface SaleItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  invoiceNo: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  received: number;
  due: number;
}

export const generateSaleInvoice = (
  business: BusinessInfo,
  customer: CustomerInfo,
  sale: InvoiceData
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Primary Colors
  const primaryColor = [37, 99, 235]; // blue-600
  const secondaryColor = [15, 23, 42]; // slate-900
  const accentColor = [241, 245, 249]; // slate-100

  // 1. Header Design
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 45, pageWidth, 2, 'F');

  // Business Name
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(business.name.toUpperCase(), 15, 25);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  let headerInfo = [];
  if (business.address) headerInfo.push(business.address);
  if (business.phone) headerInfo.push(`Tel: ${business.phone}`);
  doc.text(headerInfo.join('  |  '), 15, 33);

  // Invoice Label (Top Right)
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('INVOICE', pageWidth - 15, 28, { align: 'right' });

  // 2. Info Bar (Order Details)
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(15, 60, pageWidth - 30, 20, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE NO', 25, 68);
  doc.text('DATE', 75, 68);
  doc.text('CUSTOMER', 125, 68);

  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`#${sale.invoiceNo}`, 25, 74);
  doc.text(formatDate(sale.date), 75, 74);
  doc.text(customer.name.length > 25 ? customer.name.substring(0, 22) + '...' : customer.name, 125, 74);

  // 3. Billing Sections
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('BILL TO:', 15, 100);

  doc.setFontSize(12);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(customer.name, 15, 107);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  let billToY = 113;
  if (customer.shopName) {
    doc.text(customer.shopName.toUpperCase(), 15, billToY);
    billToY += 5;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  if (customer.phone) {
    doc.text(`+ ${customer.phone}`, 15, billToY);
    billToY += 5;
  }
  if (customer.address) {
    const splitAddress = doc.splitTextToSize(customer.address, 80);
    doc.text(splitAddress, 15, billToY);
  }

  // 4. PAID Stamp (If applicable)
  if (sale.due <= 0) {
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 252, 231); // emerald-100 equivalent for "background" look
    doc.text('PAID', pageWidth / 2, 120, { align: 'center', angle: -20 });
  }

  // 5. Items Table
  autoTable(doc, {
    startY: 130,
    head: [['#', 'Item Description', 'Qty', 'Unit Price', 'Amount']],
    body: sale.items.map((item, i) => [
      (i + 1).toString(),
      item.name,
      item.quantity.toString(),
      `Tk ${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`,
      `Tk ${item.total.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
    ]),
    theme: 'plain',
    headStyles: { 
      fillColor: [37, 99, 235], 
      textColor: 255, 
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 4
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 4,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: 15, right: 15 }
  });

  // 6. Totals & Financial Summary
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.roundedRect(pageWidth - 90, finalY, 75, 45, 2, 2, 'F');

  const rowH = 7;
  let totalY = finalY + 10;
  
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', pageWidth - 80, totalY);
  doc.setTextColor(255, 255, 255);
  doc.text(`Tk ${sale.subtotal.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, pageWidth - 25, totalY, { align: 'right' });

  totalY += rowH;
  doc.setTextColor(180, 180, 180);
  doc.text('Discount:', pageWidth - 80, totalY);
  doc.setTextColor(255, 255, 255);
  doc.text(`- Tk ${sale.discount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, pageWidth - 25, totalY, { align: 'right' });

  totalY += 5;
  doc.setDrawColor(51, 65, 85);
  doc.line(pageWidth - 80, totalY, pageWidth - 25, totalY);
  
  totalY += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL:', pageWidth - 80, totalY);
  doc.setTextColor(59, 130, 246); // light blue
  doc.text(`Tk ${sale.total.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, pageWidth - 25, totalY, { align: 'right' });

  // Payment Breakdown (Left side of totals)
  let payY = finalY + 10;
  doc.setFontSize(9);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT DETAILS', 15, payY);
  
  payY += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Paid Amount: Tk ${sale.received.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, 15, payY);
  
  payY += 6;
  if (sale.due > 0) {
    doc.setTextColor(239, 68, 68);
    doc.setFont('helvetica', 'bold');
    doc.text(`Due Balance: Tk ${sale.due.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, 15, payY);
  } else {
    doc.setTextColor(34, 197, 94);
    doc.text('Status: Fully Paid', 15, payY);
  }

  // 7. Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('TERMS & CONDITIONS', 15, pageHeight - 35);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('1. Please quote invoice number for payment references.', 15, pageHeight - 30);
  doc.text('2. Goods once sold are not returnable under normal conditions.', 15, pageHeight - 26);

  // Bottom Line
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`${business.name}  |  Generated on ${formatDateTime(new Date())}`, pageWidth / 2, pageHeight - 9, { align: 'center' });
  doc.text(`Al-Ribat Manager developed by Al-Ribat international`, pageWidth / 2, pageHeight - 4, { align: 'center' });

  const fileName = `Invoice_${sale.invoiceNo}_${customer.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};

export const generateCustomerStatement = (
  business: BusinessInfo,
  customer: CustomerInfo,
  sales: any[],
  ledger: any[],
  dateRange: { start: Date; end: Date }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Primary Colors
  const primaryColor = [37, 99, 235]; // blue-600
  const secondaryColor = [15, 23, 42]; // slate-900
  const accentColor = [248, 250, 252]; // slate-50

  // 1. Header Design
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 45, pageWidth, 2, 'F');

  // Business Name
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(business.name.toUpperCase(), 15, 25);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  let businessHeader = [];
  if (business.address) businessHeader.push(business.address);
  if (business.phone) businessHeader.push(`Tel: ${business.phone}`);
  doc.text(businessHeader.join('  |  '), 15, 33);

  doc.text('CUSTOMER ACCOUNT STATEMENT', pageWidth - 15, 25, { align: 'right' });
  doc.text(`${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`, pageWidth - 15, 32, { align: 'right' });

  // 2. Customer Profile Section
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('STATEMENT FOR:', 15, 65);

  doc.setFontSize(14);
  doc.text(customer.name.toUpperCase(), 15, 73);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  if (customer.shopName) doc.text(customer.shopName.toUpperCase(), 15, 79);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  let detailY = 85;
  if (customer.phone) {
    doc.text(`Phone: +${customer.phone}`, 15, detailY);
    detailY += 5;
  }
  if (customer.address) {
    const splitAddress = doc.splitTextToSize(`Address: ${customer.address}`, 100);
    doc.text(splitAddress, 15, detailY);
  }

  // 3. Financial Summary Grid
  // Total Sold = Total amount of all sales
  const totalSold = sales.reduce((acc, s) => acc + (s.total_cents / 100), 0);
  
  // Total Paid = (Paid at time of sale) + (Subsequent ledger payments)
  const paidAtSale = sales.reduce((acc, s) => acc + (s.received_now_bdt_cents / 100), 0);
  const paidLater = ledger.reduce((acc, l) => acc + (l.amount_cents / 100), 0);
  const totalPaid = paidAtSale + paidLater;
  
  const totalDue = totalSold - totalPaid;

  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(15, 100, pageWidth - 30, 30, 2, 2, 'F');

  const colWidth = (pageWidth - 60) / 3;
  
  // Titles
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('TOTAL BILLED', 30, 110);
  doc.text('TOTAL PAID', 30 + colWidth + 15, 110);
  doc.text('CURRENT DUE', 30 + (colWidth * 2) + 30, 110);

  // Values
  doc.setFontSize(14);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`Tk ${totalSold.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, 30, 120);
  doc.setTextColor(34, 197, 94); // success
  doc.text(`Tk ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, 30 + colWidth + 15, 120);
  doc.setTextColor(239, 68, 68); // danger
  doc.text(`Tk ${totalDue.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, 30 + (colWidth * 2) + 30, 120);

  // 4. Activity Table
  // Merge sales and ledger payments into one timeline
  const activities = [
    ...sales.map(s => ({
      date: s.created_at,
      ref: s.invoice_no,
      type: 'SALE',
      billed: s.total_cents / 100,
      paid: s.received_now_bdt_cents / 100,
      due: (s.total_cents - s.received_now_bdt_cents) / 100,
      status: s.due_cents === 0 ? 'FULLY PAID' : 'PARTIAL'
    })),
    ...ledger.map(l => ({
      date: l.created_at,
      ref: 'Payment',
      type: 'Due',
      billed: 0,
      paid: l.amount_cents / 100,
      due: 0,
      status: 'RECEIPT'
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  autoTable(doc, {
    startY: 140,
    head: [['Date', 'Description / Ref', 'Type', 'Billed', 'Paid', 'Invoice Balance']],
    body: activities.map(act => [
      formatDate(act.date),
      act.ref,
      act.type,
      act.billed > 0 ? `Tk ${act.billed.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}` : '-',
      act.paid > 0 ? `Tk ${act.paid.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}` : '-',
      act.type === 'SALE' ? `Tk ${act.due.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}` : '-'
    ]),
    theme: 'plain',
    headStyles: { 
      fillColor: [15, 23, 42], 
      textColor: 255, 
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 4,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right', textColor: [34, 197, 94], fontStyle: 'bold' },
      5: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 15, right: 15 }
  });

  // 5. Footer Design
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(15, finalY, pageWidth - 15, finalY);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Notes / Legend:', 15, finalY + 10);
  doc.text('- Billed amount includes all products and applicable taxes.', 15, finalY + 15);
  doc.text('- Paid amount reflects payments received until selected date range.', 15, finalY + 20);

  // Bottom Branding
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`${business.name} | ${business.phone || ''} | Account Statement`, pageWidth / 2, pageHeight - 9, { align: 'center' });
  doc.text(`Al-Ribat Manager developed by Al-Ribat international`, pageWidth / 2, pageHeight - 4, { align: 'center' });

  const fileName = `Statement_${customer.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};

export const generatePaymentReceipt = (
  business: BusinessInfo,
  customer: CustomerInfo,
  payment: {
    date: string;
    amount: number;
    method: string;
    remainingDue: number;
  }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const primaryColor = [37, 99, 235];
  const secondaryColor = [15, 23, 42];
  const accentColor = [241, 245, 249];

  // Header
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 45, pageWidth, 2, 'F');

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(business.name.toUpperCase(), 15, 25);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text(`${business.address || ''}  |  Tel: ${business.phone || ''}`, 15, 33);

  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('PAYMENT RECEIPT', pageWidth - 15, 28, { align: 'right' });

  // Body
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIVED FROM:', 15, 65);
  doc.setFontSize(14);
  doc.text(customer.name.toUpperCase(), 15, 73);
  doc.setFontSize(10);
  if (customer.shopName) doc.text(customer.shopName.toUpperCase(), 15, 79);

  // Receipt Details Box
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(15, 90, pageWidth - 30, 60, 2, 2, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Date:', 25, 105);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDateTime(payment.date), 70, 105);

  doc.setFont('helvetica', 'normal');
  doc.text('Payment Type:', 25, 115);
  doc.setFont('helvetica', 'bold');
  doc.text('Due', 70, 115); // Explicitly "Due" as requested

  doc.setFont('helvetica', 'normal');
  doc.text('Payment Method:', 25, 125);
  doc.setFont('helvetica', 'bold');
  doc.text(payment.method.toUpperCase(), 70, 125);

  doc.setFontSize(16);
  doc.setTextColor(34, 197, 94); // emerald-600
  doc.text('Amount Paid:', 25, 140);
  doc.text(`Tk ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, 70, 140);

  // Remaining Balance
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Remaining Due:', 15, 170);
  doc.setFont('helvetica', 'bold');
  if (payment.remainingDue > 0) {
    doc.setTextColor(239, 68, 68);
  } else {
    doc.setTextColor(34, 197, 94);
  }
  doc.text(`Tk ${payment.remainingDue.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, 50, 170);

  // Footer
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`${business.name}  |  Official Payment Receipt`, pageWidth / 2, pageHeight - 9, { align: 'center' });
  doc.text(`Al-Ribat Manager developed by Al-Ribat international`, pageWidth / 2, pageHeight - 4, { align: 'center' });

  const fileName = `Receipt_${customer.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(fileName);
};

export interface ReportData {
  period: string;
  metrics: {
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
    salesCount: number;
    unitsSold: number;
    overdueCount: number;
    totalPurchases?: number;
    cashCollected?: number;
    distributions?: number;
  };
  financials: {
    cashBalance: number;
    receivables: number;
    payables: number;
    inventoryValue: number;
    rmbBalance?: number;
  };
  expensesByCategory?: Array<{ category: string; amount: number }>;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

export const generateBusinessReport = (
  business: BusinessInfo,
  data: ReportData
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const primaryColor: [number, number, number] = [37, 99, 235];
  const secondaryColor: [number, number, number] = [15, 23, 42];
  const accentColor: [number, number, number] = [248, 250, 252];
  const successColor: [number, number, number] = [34, 197, 94];
  const dangerColor: [number, number, number] = [239, 68, 68];

  // 1. Creative Header
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(business.name.toUpperCase(), 15, 30);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text('OPERATIONAL EXCELLENCE & ANALYTICS REPORT', 15, 42);
  
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(data.period.toUpperCase(), pageWidth - 15, 30, { align: 'right' });
  doc.setFontSize(8);
  doc.text(`ISSUED: ${isValidDate(new Date()) ? format(new Date(), 'dd/MM/yyyy HH:mm') : '-'}`, pageWidth - 15, 38, { align: 'right' });

  // 2. Dashboard
  let currentY = 75;
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('I. KEY PERFORMANCE INDICATORS', 15, currentY);

  const drawCard = (x: number, y: number, w: number, h: number, label: string, value: string, color: number[]) => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, w, h, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), x + 5, y + 10);
    doc.setFontSize(12);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x + 5, y + 22);
  };

  const cardW = (pageWidth - 40) / 3;
  const cardH = 30;
  
  drawCard(15, currentY + 5, cardW, cardH, 'Revenue', `Tk ${data.metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, secondaryColor);
  drawCard(15 + cardW + 5, currentY + 5, cardW, cardH, 'Gross Profit', `Tk ${data.metrics.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, successColor);
  drawCard(15 + (cardW + 5) * 2, currentY + 5, cardW, cardH, 'Net Profit', `Tk ${data.metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, data.metrics.netProfit >= 0 ? successColor : dangerColor);

  currentY += 45;

  // 3. P&L
  autoTable(doc, {
    startY: currentY,
    head: [['Description', 'Amount (BDT)']],
    body: [
      ['Sales Revenue', `Tk ${data.metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`],
      ['Cost of Goods (COGS)', `- Tk ${data.metrics.totalCost.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`],
      ['Operating Expenses', `- Tk ${data.metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`],
      [{ content: 'NET PROFIT', styles: { fontStyle: 'bold' } }, { content: `Tk ${data.metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, styles: { fontStyle: 'bold', textColor: data.metrics.netProfit >= 0 ? successColor : dangerColor } }]
    ],
    theme: 'striped',
    headStyles: { fillColor: secondaryColor },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // 4. Operational
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('II. ASSETS & MARKET ACTIVITY', 15, currentY);

  autoTable(doc, {
    startY: currentY + 5,
    head: [['Category', 'Value / Volume']],
    body: [
      ['Cash Balance (BDT)', `Tk ${data.financials.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`],
      ['Receivables (Dues)', `Tk ${data.financials.receivables.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`],
      ['Inventory Value', `Tk ${data.financials.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`],
      ['Total Purchases (Cycle)', `Tk ${(data.metrics.totalPurchases || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`],
      ['Cash Collected', `Tk ${(data.metrics.cashCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`],
      ['Profit Distributions', `Tk ${(data.metrics.distributions || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${business.name} | Excellence Report | Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 9, { align: 'center' });
    doc.text(`Al-Ribat Manager developed by Al-Ribat international`, pageWidth / 2, pageHeight - 4, { align: 'center' });
  }

  const fileName = `Excellence_Report_${data.period.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};
