import * as XLSX from "xlsx";
import { formatCurrency, formatUsd, type InventoryRow } from "./inventory";
import type { OrderItem } from "./order";

export type QuotationCurrency = "COP" | "USD";
export type CopPriceType = "PVM" | "PVP";

export interface QuotationConfig {
  currency: QuotationCurrency;
  copPriceType: CopPriceType;
  customerName?: string;
  advisorName?: string;
  notes?: string;
}

export interface QuotationItemSummary {
  sku: string;
  referencia: string;
  descripcion: string;
  color: string;
  talla: string;
  cantidad: number;
  unitPrice: number;
  totalPrice: number;
  currency: QuotationCurrency;
  formattedUnitPrice: string;
  formattedTotalPrice: string;
}

export interface QuotationData {
  quotationNumber: string;
  date: Date;
  dateFormatted: string;
  customerName: string;
  advisorName: string;
  notes: string;
  currency: QuotationCurrency;
  copPriceType: CopPriceType;
  items: QuotationItemSummary[];
  totalUnits: number;
  totalReferences: number;
  totalAmount: number;
  formattedTotal: string;
}

/**
 * Calculates item and total prices based on the advisor's chosen currency:
 * - COP: Multiplies units by PVM (wholesale) or PVP (retail).
 * - USD: Multiplies units by precioUsd.
 */
export function buildQuotationData(
  items: OrderItem[],
  config: QuotationConfig,
  inventoryLookup?: Record<string, InventoryRow>
): QuotationData {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const dateFormatted = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const quotationNumber = `COT-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${randomSuffix}`;

  const isUsd = config.currency === "USD";
  const trmFallback = 4000;

  const itemSummaries: QuotationItemSummary[] = items
    .filter((it) => it.cantidad > 0)
    .map((it) => {
      const invRow = inventoryLookup?.[it.sku];
      let unitPrice = 0;

      if (isUsd) {
        // Priority: item.precioUsd -> invRow.precioUsd -> calculated fallback from PVM / TRM
        if (it.precioUsd && it.precioUsd > 0) {
          unitPrice = it.precioUsd;
        } else if (invRow?.precioUsd && invRow.precioUsd > 0) {
          unitPrice = invRow.precioUsd;
        } else {
          const basePvm = it.pvm || invRow?.pvm || 0;
          unitPrice = Math.ceil(((basePvm / 1.19 + 1000) / trmFallback) * 100) / 100;
        }
      } else {
        // Colombian Pesos (COP)
        if (config.copPriceType === "PVP") {
          unitPrice = it.pvp ?? invRow?.pvp ?? it.pvm ?? 0;
        } else {
          unitPrice = it.pvm ?? invRow?.pvm ?? 0;
        }
      }

      // Calculation required: units * price
      const totalPrice = it.cantidad * unitPrice;

      return {
        sku: it.sku,
        referencia: it.referencia,
        descripcion: it.descripcion,
        color: it.color,
        talla: it.talla,
        cantidad: it.cantidad,
        unitPrice,
        totalPrice,
        currency: config.currency,
        formattedUnitPrice: isUsd ? formatUsd(unitPrice) : formatCurrency(unitPrice),
        formattedTotalPrice: isUsd ? formatUsd(totalPrice) : formatCurrency(totalPrice),
      };
    });

  const totalUnits = itemSummaries.reduce((sum, it) => sum + it.cantidad, 0);
  const totalAmount = itemSummaries.reduce((sum, it) => sum + it.totalPrice, 0);
  const distinctRefs = new Set(itemSummaries.map((it) => it.referencia)).size;

  return {
    quotationNumber,
    date: now,
    dateFormatted,
    customerName: (config.customerName || "").trim() || "Cliente Comercial",
    advisorName: (config.advisorName || "").trim() || "Asesor Trucco's Denim",
    notes: (config.notes || "").trim() || "Cotización comercial sujeta a disponibilidad de inventario.",
    currency: config.currency,
    copPriceType: config.copPriceType,
    items: itemSummaries,
    totalUnits,
    totalReferences: distinctRefs,
    totalAmount,
    formattedTotal: isUsd ? formatUsd(totalAmount) : formatCurrency(totalAmount),
  };
}

/**
 * Generates and downloads a clean, formatted Excel spreadsheet (.xlsx).
 */
export function downloadQuotationExcel(quotation: QuotationData): void {
  const isUsd = quotation.currency === "USD";
  const currencyLabel = isUsd
    ? "Dólares Americanos (USD)"
    : `Pesos Colombianos (COP) - ${quotation.copPriceType === "PVM" ? "Mayorista (PVM)" : "Detal (PVP)"}`;

  const aoa: (string | number)[][] = [
    ["TRUCCO'S DENIM - COMERCIAL TRUCCOS S.A.S."],
    ["COTIZACIÓN COMERCIAL"],
    [],
    ["N° Cotización:", quotation.quotationNumber, "", "Fecha:", quotation.dateFormatted],
    ["Asesor Comercial:", quotation.advisorName, "", "Moneda:", currencyLabel],
    ["Cliente:", quotation.customerName],
    ["Condiciones:", quotation.notes],
    [],
    [
      "#",
      "Referencia",
      "Descripción de Prenda",
      "Color",
      "Talla",
      "Cantidad (Uds)",
      `Precio Unitario (${quotation.currency})`,
      `Total (${quotation.currency})`,
    ],
  ];

  quotation.items.forEach((it, idx) => {
    aoa.push([
      idx + 1,
      it.referencia,
      it.descripcion,
      it.color,
      it.talla,
      it.cantidad,
      it.unitPrice,
      it.totalPrice,
    ]);
  });

  aoa.push([]);
  aoa.push([
    "",
    "",
    "",
    "",
    "TOTAL UNIDADES:",
    quotation.totalUnits,
    `TOTAL COTIZACIÓN (${quotation.currency}):`,
    quotation.totalAmount,
  ]);
  aoa.push([]);
  aoa.push(["* Precios calculados multiplicando las unidades por el valor en " + quotation.currency]);
  aoa.push(["* Cotización válida por 15 días calendario. Sujeta a rotación de inventario."]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set explicit column widths for readability
  ws["!cols"] = [
    { wch: 5 },  // #
    { wch: 16 }, // Referencia
    { wch: 34 }, // Descripción
    { wch: 16 }, // Color
    { wch: 10 }, // Talla
    { wch: 14 }, // Cantidad
    { wch: 22 }, // Precio Unitario
    { wch: 22 }, // Total
  ];

  // Force string format on Referencia and Talla columns
  for (let r = 9; r < 9 + quotation.items.length; r++) {
    const cellRef = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cellRef) cellRef.t = "s";
    const cellTalla = ws[XLSX.utils.encode_cell({ r, c: 4 })];
    if (cellTalla) cellTalla.t = "s";
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cotización");

  const cleanName = quotation.customerName.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  const filename = `COTIZACION_${cleanName}_${quotation.currency}_${quotation.quotationNumber}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Escapes characters for PDF stream strings and normalizes accents for standard fonts.
 */
function sanitizePdf(str: string): string {
  if (!str) return "";
  return str
    .replace(/[\r\n]+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Pure TypeScript PDF 1.4 Vector Generator.
 * Produces a pixel-perfect, multi-page vector PDF with zero runtime npm dependencies.
 */
export function generateQuotationPdfBlob(quotation: QuotationData): Blob {
  const pageWidth = 612; // Letter width
  const pageHeight = 792; // Letter height
  const marginLeft = 36;
  const marginRight = 576; // 612 - 36
  const usableWidth = marginRight - marginLeft; // 540 pt

  const isUsd = quotation.currency === "USD";
  const currencyBadgeText = isUsd
    ? "MONEDA: DOLARES (USD)"
    : `MONEDA: PESOS (COP) - ${quotation.copPriceType === "PVM" ? "MAYORISTA PVM" : "DETAL PVP"}`;

  // Pagination planning
  const rowsPerPageFirst = 18;
  const rowsPerPageNext = 26;

  const totalItems = quotation.items.length;
  let totalPages = 1;
  if (totalItems > rowsPerPageFirst) {
    totalPages = 1 + Math.ceil((totalItems - rowsPerPageFirst) / rowsPerPageNext);
  }

  const pageStreams: string[] = [];
  let itemIndex = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;
    let s = "";

    // 1. Top Header Banner
    // Navy top bar
    s += "q\n";
    s += "0.07 0.12 0.22 rg\n"; // Deep Navy #121f38
    s += `${marginLeft} ${pageHeight - 80} ${usableWidth} 44 re f\n`;

    // Title text
    s += "1 1 1 rg\n";
    s += `BT /F2 16 Tf ${marginLeft + 14} ${pageHeight - 56} Td (TRUCCO'S DENIM) Tj ET\n`;
    s += `BT /F1 8.5 Tf ${marginLeft + 14} ${pageHeight - 70} Td (Comercial Truccos S.A.S. - NIT 900.228.614-1) Tj ET\n`;

    // Right header badge
    s += "0.02 0.58 0.41 rg\n"; // Emerald #059669
    s += `${marginRight - 150} ${pageHeight - 74} 138 32 re f\n`;
    s += "1 1 1 rg\n";
    s += `BT /F2 11 Tf ${marginRight - 142} ${pageHeight - 56} Td (COTIZACION COMERCIAL) Tj ET\n`;
    s += `BT /F1 8 Tf ${marginRight - 142} ${pageHeight - 68} Td (${sanitizePdf(quotation.quotationNumber)}) Tj ET\n`;
    s += "Q\n";

    let currentY = pageHeight - 95;

    // 2. Info Cards (First page only)
    if (isFirstPage) {
      s += "q\n";
      // Card 1: Client & Advisor Info Box
      s += "0.96 0.97 0.98 rg\n"; // Light slate bg
      s += `0.85 0.88 0.92 RG 0.5 w\n`;
      s += `${marginLeft} ${currentY - 60} ${usableWidth * 0.62} 60 re b\n`;

      s += "0.15 0.20 0.30 rg\n";
      s += `BT /F2 9 Tf ${marginLeft + 10} ${currentY - 16} Td (DATOS DEL CLIENTE) Tj ET\n`;
      s += `BT /F1 8.5 Tf ${marginLeft + 10} ${currentY - 30} Td (Cliente: ${sanitizePdf(quotation.customerName)}) Tj ET\n`;
      s += `BT /F1 8.5 Tf ${marginLeft + 10} ${currentY - 44} Td (Asesor: ${sanitizePdf(quotation.advisorName)}) Tj ET\n`;
      s += `BT /F1 7.5 Tf ${marginLeft + 10} ${currentY - 55} Td (Fecha: ${sanitizePdf(quotation.dateFormatted)}) Tj ET\n`;

      // Card 2: Currency & Summary Box
      const rightCardX = marginLeft + usableWidth * 0.64;
      const rightCardW = usableWidth * 0.36;
      s += "0.94 0.98 0.96 rg\n"; // Light emerald bg
      s += "0.20 0.65 0.45 RG 0.5 w\n";
      s += `${rightCardX} ${currentY - 60} ${rightCardW} 60 re b\n`;

      s += "0.02 0.45 0.32 rg\n";
      s += `BT /F2 8.5 Tf ${rightCardX + 10} ${currentY - 16} Td (${sanitizePdf(currencyBadgeText)}) Tj ET\n`;
      s += `BT /F1 8 Tf ${rightCardX + 10} ${currentY - 30} Td (Unidades Totales: ${quotation.totalUnits} uds.) Tj ET\n`;
      s += `BT /F1 8 Tf ${rightCardX + 10} ${currentY - 42} Td (Referencias: ${quotation.totalReferences}) Tj ET\n`;
      s += `BT /F2 9 Tf ${rightCardX + 10} ${currentY - 55} Td (Total: ${sanitizePdf(quotation.formattedTotal)}) Tj ET\n`;
      s += "Q\n";

      currentY -= 72;
    }

    // 3. Table Headers
    const colX = {
      num: marginLeft,
      ref: marginLeft + 24,
      desc: marginLeft + 94,
      col: marginLeft + 264,
      talla: marginLeft + 334,
      cant: marginLeft + 370,
      unit: marginLeft + 415,
      tot: marginLeft + 480,
    };

    s += "q\n";
    // Header row background
    s += "0.10 0.16 0.28 rg\n"; // Navy
    s += `${marginLeft} ${currentY - 18} ${usableWidth} 18 re f\n`;

    // Header column labels
    s += "1 1 1 rg\n";
    s += `BT /F2 7.5 Tf ${colX.num + 4} ${currentY - 13} Td (#) Tj ET\n`;
    s += `BT /F2 7.5 Tf ${colX.ref + 4} ${currentY - 13} Td (REFERENCIA) Tj ET\n`;
    s += `BT /F2 7.5 Tf ${colX.desc + 4} ${currentY - 13} Td (DESCRIPCION / PRENDA) Tj ET\n`;
    s += `BT /F2 7.5 Tf ${colX.col + 4} ${currentY - 13} Td (COLOR) Tj ET\n`;
    s += `BT /F2 7.5 Tf ${colX.talla + 4} ${currentY - 13} Td (TALLA) Tj ET\n`;
    s += `BT /F2 7.5 Tf ${colX.cant + 4} ${currentY - 13} Td (CANT) Tj ET\n`;
    s += `BT /F2 7.5 Tf ${colX.unit + 4} ${currentY - 13} Td (P. UNIT) Tj ET\n`;
    s += `BT /F2 7.5 Tf ${colX.tot + 4} ${currentY - 13} Td (TOTAL) Tj ET\n`;
    s += "Q\n";

    currentY -= 18;

    // 4. Data Rows
    const rowsThisPage = isFirstPage ? rowsPerPageFirst : rowsPerPageNext;
    const pageItemEnd = Math.min(totalItems, itemIndex + rowsThisPage);
    const rowHeight = 16;

    for (let i = itemIndex; i < pageItemEnd; i++) {
      const it = quotation.items[i];
      const isZebra = i % 2 === 1;

      s += "q\n";
      if (isZebra) {
        s += "0.97 0.98 0.99 rg\n";
        s += `${marginLeft} ${currentY - rowHeight} ${usableWidth} ${rowHeight} re f\n`;
      }

      // Bottom border for row
      s += "0.88 0.90 0.94 RG 0.3 w\n";
      s += `${marginLeft} ${currentY - rowHeight} m ${marginRight} ${currentY - rowHeight} l S\n`;

      // Text values
      s += "0.15 0.18 0.22 rg\n";
      s += `BT /F1 7.5 Tf ${colX.num + 4} ${currentY - 11} Td (${i + 1}) Tj ET\n`;
      s += `BT /F2 7.5 Tf ${colX.ref + 4} ${currentY - 11} Td (${sanitizePdf(it.referencia)}) Tj ET\n`;

      // Truncate long descriptions cleanly
      const maxDescLen = 30;
      const descText =
        it.descripcion.length > maxDescLen
          ? it.descripcion.substring(0, maxDescLen - 2) + ".."
          : it.descripcion;
      s += `BT /F1 7 Tf ${colX.desc + 4} ${currentY - 11} Td (${sanitizePdf(descText)}) Tj ET\n`;

      const colorText =
        it.color.length > 12 ? it.color.substring(0, 10) + ".." : it.color;
      s += `BT /F1 7 Tf ${colX.col + 4} ${currentY - 11} Td (${sanitizePdf(colorText)}) Tj ET\n`;
      s += `BT /F1 7.5 Tf ${colX.talla + 6} ${currentY - 11} Td (${sanitizePdf(it.talla)}) Tj ET\n`;
      s += `BT /F2 7.5 Tf ${colX.cant + 8} ${currentY - 11} Td (${it.cantidad}) Tj ET\n`;
      s += `BT /F1 7 Tf ${colX.unit + 2} ${currentY - 11} Td (${sanitizePdf(it.formattedUnitPrice)}) Tj ET\n`;
      s += `BT /F2 7.5 Tf ${colX.tot + 2} ${currentY - 11} Td (${sanitizePdf(it.formattedTotalPrice)}) Tj ET\n`;
      s += "Q\n";

      currentY -= rowHeight;
    }

    itemIndex = pageItemEnd;

    // 5. Grand Totals Summary (Last Page Only)
    if (isLastPage) {
      currentY -= 12;
      s += "q\n";
      // Totals box background
      s += "0.07 0.12 0.22 rg\n";
      s += `${marginLeft + usableWidth * 0.45} ${currentY - 48} ${usableWidth * 0.55} 48 re f\n`;

      s += "1 1 1 rg\n";
      s += `BT /F1 8.5 Tf ${marginLeft + usableWidth * 0.48} ${currentY - 18} Td (UNIDADES SELECCIONADAS:) Tj ET\n`;
      s += `BT /F2 10 Tf ${marginRight - 80} ${currentY - 18} Td (${quotation.totalUnits} uds.) Tj ET\n`;

      s += "0.02 0.58 0.41 rg\n";
      s += `${marginLeft + usableWidth * 0.45} ${currentY - 48} ${usableWidth * 0.55} 24 re f\n`;
      s += "1 1 1 rg\n";
      s += `BT /F2 10 Tf ${marginLeft + usableWidth * 0.48} ${currentY - 38} Td (TOTAL COTIZACION:) Tj ET\n`;
      s += `BT /F2 12 Tf ${marginRight - 120} ${currentY - 38} Td (${sanitizePdf(quotation.formattedTotal)}) Tj ET\n`;

      // Commercial note on left side
      s += "0.35 0.40 0.48 rg\n";
      s += `BT /F2 7.5 Tf ${marginLeft} ${currentY - 16} Td (OBSERVACIONES:) Tj ET\n`;
      s += `BT /F1 7 Tf ${marginLeft} ${currentY - 28} Td (${sanitizePdf(quotation.notes)}) Tj ET\n`;
      s += `BT /F1 7 Tf ${marginLeft} ${currentY - 40} Td (Precios calculados en base a unidades seleccionadas en ${quotation.currency}.) Tj ET\n`;
      s += "Q\n";
    }

    // 6. Footer bar
    s += "q\n";
    s += "0.85 0.88 0.92 RG 0.5 w\n";
    s += `${marginLeft} 45 m ${marginRight} 45 l S\n`;
    s += "0.45 0.50 0.58 rg\n";
    s += `BT /F1 7 Tf ${marginLeft} 34 Td (Trucco's Denim - Calle 46 # 53-14 Medellin, Colombia - www.truccos.com.co) Tj ET\n`;
    s += `BT /F1 7 Tf ${marginRight - 70} 34 Td (Pagina ${pageNum} de ${totalPages}) Tj ET\n`;
    s += "Q\n";

    pageStreams.push(s);
  }

  // Build PDF document objects
  const objects: string[] = [];

  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // For each page: Page Object + Content Stream Object

  const catalogObjIndex = 1;
  const pagesObjIndex = 2;
  const fontF1ObjIndex = 3;
  const fontF2ObjIndex = 4;

  const fontF1 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  const fontF2 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  const pageObjectIndices: number[] = [];
  const streamObjectIndices: number[] = [];

  let nextObjIndex = 5;
  for (let i = 0; i < totalPages; i++) {
    pageObjectIndices.push(nextObjIndex++);
    streamObjectIndices.push(nextObjIndex++);
  }

  const pagesKids = pageObjectIndices.map((idx) => `${idx} 0 R`).join(" ");
  const pagesObj = `<< /Type /Pages /Kids [${pagesKids}] /Count ${totalPages} >>`;
  const catalogObj = `<< /Type /Catalog /Pages ${pagesObjIndex} 0 R >>`;

  const allObjs: string[] = [];
  allObjs[catalogObjIndex - 1] = catalogObj;
  allObjs[pagesObjIndex - 1] = pagesObj;
  allObjs[fontF1ObjIndex - 1] = fontF1;
  allObjs[fontF2ObjIndex - 1] = fontF2;

  for (let i = 0; i < totalPages; i++) {
    const pageObjIdx = pageObjectIndices[i];
    const streamObjIdx = streamObjectIndices[i];
    const streamContent = pageStreams[i];
    const streamBytes = new TextEncoder().encode(streamContent).length;

    const pageObj = `<< /Type /Page /Parent ${pagesObjIndex} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontF1ObjIndex} 0 R /F2 ${fontF2ObjIndex} 0 R >> >> /Contents ${streamObjIdx} 0 R >>`;
    const streamObj = `<< /Length ${streamBytes} >>\nstream\n${streamContent}\nendstream`;

    allObjs[pageObjIdx - 1] = pageObj;
    allObjs[streamObjIdx - 1] = streamObj;
  }

  // Assemble PDF file with correct byte offsets
  let header = "%PDF-1.4\n";
  let body = "";
  const offsets: number[] = [];

  for (let i = 0; i < allObjs.length; i++) {
    const currentOffset = new TextEncoder().encode(header + body).length;
    offsets.push(currentOffset);
    body += `${i + 1} 0 obj\n${allObjs[i]}\nendobj\n`;
  }

  const startxref = new TextEncoder().encode(header + body).length;
  let xref = `xref\n0 ${allObjs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }

  const trailer = `trailer\n<< /Size ${allObjs.length + 1} /Root ${catalogObjIndex} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  const fullPdfString = header + body + xref + trailer;
  return new Blob([new TextEncoder().encode(fullPdfString)], { type: "application/pdf" });
}

/**
 * Generates and triggers browser download of the PDF file.
 */
export function downloadQuotationPdf(quotation: QuotationData): void {
  const blob = generateQuotationPdfBlob(quotation);
  const cleanName = (quotation.customerName || "CLIENTE").replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  const cleanNumber = (quotation.quotationNumber || "COTIZACION").replace(/[^A-Za-z0-9]/g, "_");
  const filename = `COTIZACION_${cleanName}_${quotation.currency}_${cleanNumber}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 60000);
}

/**
 * Opens a print-friendly HTML window for instant printing or browser PDF export.
 */
export function openQuotationPrintView(quotation: QuotationData): void {
  const isUsd = quotation.currency === "USD";
  const currencyBadge = isUsd
    ? "DÓLARES AMERICANOS (USD)"
    : `PESOS COLOMBIANOS (COP) - ${quotation.copPriceType === "PVM" ? "MAYORISTA (PVM)" : "DETAL (PVP)"}`;

  const rowsHtml = quotation.items
    .map(
      (it, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
      <td style="padding: 8px 10px; font-size: 11px; text-align: center;">${idx + 1}</td>
      <td style="padding: 8px 10px; font-size: 11px; font-weight: bold; font-family: monospace;">${it.referencia}</td>
      <td style="padding: 8px 10px; font-size: 11px;">${it.descripcion}</td>
      <td style="padding: 8px 10px; font-size: 11px;">${it.color}</td>
      <td style="padding: 8px 10px; font-size: 11px; text-align: center;">${it.talla}</td>
      <td style="padding: 8px 10px; font-size: 11px; text-align: center; font-weight: bold;">${it.cantidad}</td>
      <td style="padding: 8px 10px; font-size: 11px; text-align: right;">${it.formattedUnitPrice}</td>
      <td style="padding: 8px 10px; font-size: 11px; text-align: right; font-weight: bold; color: #0f172a;">${it.formattedTotalPrice}</td>
    </tr>
  `
    )
    .join("");

  const printHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Cotización ${quotation.quotationNumber} - Trucco's Denim</title>
    <style>
      @page { size: letter; margin: 12mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 20px; }
      .header-card { background: #0f172a; color: white; padding: 20px 24px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
      .header-title h1 { margin: 0; font-size: 22px; letter-spacing: 0.5px; }
      .header-title p { margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; }
      .header-badge { background: #059669; padding: 8px 16px; border-radius: 6px; text-align: right; }
      .header-badge h2 { margin: 0; font-size: 14px; font-weight: bold; }
      .header-badge p { margin: 2px 0 0 0; font-size: 11px; opacity: 0.9; }
      .info-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; margin: 20px 0; }
      .info-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; background: #f8fafc; }
      .info-box h3 { margin: 0 0 8px 0; font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
      .info-box p { margin: 4px 0; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th { background: #1e293b; color: white; padding: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      .totals-box { margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
      .notes { max-width: 55%; font-size: 11px; color: #64748b; }
      .grand-total { background: #0f172a; color: white; padding: 16px 24px; border-radius: 8px; min-width: 260px; text-align: right; }
      .grand-total .units { font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
      .grand-total .amount { font-size: 20px; font-weight: 800; color: #34d399; }
      .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
      @media print {
        body { padding: 0; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="no-print" style="margin-bottom: 20px; display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">
        🖨️ Imprimir / Guardar como PDF
      </button>
      <button onclick="window.close()" style="background: #e2e8f0; color: #334155; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
        Cerrar
      </button>
    </div>

    <div class="header-card">
      <div class="header-title">
        <h1>TRUCCO'S DENIM</h1>
        <p>Comercial Truccos S.A.S. - NIT 900.228.614-1</p>
      </div>
      <div class="header-badge">
        <h2>COTIZACIÓN COMERCIAL</h2>
        <p>${quotation.quotationNumber}</p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>Datos del Cliente y Asesor</h3>
        <p><strong>Cliente:</strong> ${quotation.customerName}</p>
        <p><strong>Asesor Comercial:</strong> ${quotation.advisorName}</p>
        <p><strong>Fecha de Expedición:</strong> ${quotation.dateFormatted}</p>
      </div>
      <div class="info-box" style="background: #ecfdf5; border-color: #a7f3d0;">
        <h3 style="color: #065f46;">Condiciones Comerciales</h3>
        <p><strong>Moneda:</strong> ${currencyBadge}</p>
        <p><strong>Unidades Totales:</strong> ${quotation.totalUnits} prendas</p>
        <p><strong>Referencias:</strong> ${quotation.totalReferences} modelos distintos</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th style="text-align: left;">Referencia</th>
          <th style="text-align: left;">Prenda / Descripción</th>
          <th style="text-align: left;">Color</th>
          <th>Talla</th>
          <th>Cant.</th>
          <th style="text-align: right;">P. Unitario</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="notes">
        <p><strong>Observaciones:</strong> ${quotation.notes}</p>
        <p>* Precios calculados en base a unidades seleccionadas multiplicadas por el valor en ${quotation.currency}.</p>
        <p>* Cotización válida por 15 días calendario. Sujeta a rotación física en bodegas.</p>
      </div>
      <div class="grand-total">
        <div class="units">Total Unidades: <strong>${quotation.totalUnits} uds.</strong></div>
        <div style="font-size: 11px; text-transform: uppercase; color: #cbd5e1; margin-bottom: 2px;">Total Cotización (${quotation.currency})</div>
        <div class="amount">${quotation.formattedTotal}</div>
      </div>
    </div>

    <div class="footer">
      Trucco's Denim · Calle 46 # 53-14 Medellín, Colombia · www.truccos.com.co · Línea de Atención: (604) 448 01 23
    </div>
  </body>
  </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }
}
