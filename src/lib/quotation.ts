import * as XLSX from "xlsx";
import { formatCurrency, formatUsd, type InventoryRow } from "./inventory";
import type { OrderItem } from "./order";
import {
  TRUCCOS_BRAND_INFO,
  TRUCCOS_LOGO_WIDTH,
  TRUCCOS_LOGO_HEIGHT,
  TRUCCOS_LOGO_JPEG_BASE64,
  base64ToUint8Array,
} from "./brandAssets";

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
    advisorName: (config.advisorName || "").trim() || "Asesor Trucco's Jeans",
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
    ["TRUCCO'S JEANS - COMERCIAL TRUCCOS S.A.S. (NIT 900.228.614-1)"],
    ["COTIZACIÓN COMERCIAL"],
    ["Cra 56 # 46-49 Ed. Pompano Of. 901, Medellín - Colombia | www.truccos.com.co"],
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
 * Cleans text for PDF output:
 * - Replaces '@' with 'A' (e.g. CLASIC@ -> CLASICA)
 * - Normalizes accents and diacritics to basic ASCII for standard Helvetica
 * - Strips unprintable control characters
 */
function cleanText(str: string): string {
  if (!str) return "";
  return str
    .replace(/@/g, "A")
    .replace(/[áàäâã]/gi, "a")
    .replace(/[éèëê]/gi, "e")
    .replace(/[íìïî]/gi, "i")
    .replace(/[óòöôõ]/gi, "o")
    .replace(/[úùüû]/gi, "u")
    .replace(/ñ/gi, "N")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Escapes characters for PDF stream strings.
 */
function escapePdf(str: string): string {
  return cleanText(str)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Pure TypeScript PDF 1.4 Vector Generator.
 * Produces an authentic, high-end fashion brand quotation PDF using official
 * Trucco's Jeans (https://truccos.com.co/) brand colors and embedded vector logo.
 */
export function generateQuotationPdfBlob(quotation: QuotationData): Blob {
  const pageWidth = 612; // Letter width
  const pageHeight = 792; // Letter height
  const marginLeft = 36;
  const marginRight = 576; // 612 - 36
  const usableWidth = marginRight - marginLeft; // 540 pt

  const isUsd = quotation.currency === "USD";
  const currencyBadgeText = isUsd
    ? "DOLARES (USD)"
    : quotation.copPriceType === "PVM"
    ? "COP - MAYORISTA PVM"
    : "COP - DETAL PVP";

  // Pagination planning
  const rowsPerPageFirst = 18;
  const rowsPerPageNext = 26;

  const totalItems = quotation.items.length;
  let totalPages = 1;
  if (totalItems > rowsPerPageFirst) {
    totalPages = 1 + Math.ceil((totalItems - rowsPerPageFirst) / rowsPerPageNext);
  }

  // Decode official brand logo JPEG into binary buffer
  const jpegBuffer = base64ToUint8Array(TRUCCOS_LOGO_JPEG_BASE64);

  const pageStreams: string[] = [];
  let itemIndex = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;
    let s = "";

    // 1. Top Brand Accent Line (Slate Gray #475569)
    s += "q\n";
    s += "0.30 0.35 0.42 rg\n";
    s += `${marginLeft} ${pageHeight - 34} ${usableWidth} 3.5 re f\n`;
    s += "Q\n";

    // 2. Modern Header with Official Logo and Brand Identity
    s += "q\n";
    // Draw Logo on the left: 62 pt width, 35 pt height
    const logoW = 62;
    const logoH = 35;
    const logoX = marginLeft;
    const logoY = pageHeight - 82;
    s += `${logoW} 0 0 ${logoH} ${logoX} ${logoY} cm\n`;
    s += "/ImLogo Do\n";
    s += "Q\n";

    // Text right of logo
    const textStartX = marginLeft + 72;
    s += "q\n";
    s += "0.04 0.04 0.04 rg\n"; // Deep Noir #0B0B0B
    s += `BT /F2 17 Tf ${textStartX} ${pageHeight - 56} Td (TRUCCO'S JEANS) Tj ET\n`;

    s += "0.35 0.40 0.48 rg\n"; // Slate Gray Subtitle
    s += `BT /F2 7.5 Tf ${textStartX} ${pageHeight - 69} Td (COMERCIAL TRUCCOS S.A.S.  |  NIT 900.228.614-1) Tj ET\n`;

    s += "0.45 0.45 0.50 rg\n"; // Address and web
    s += `BT /F1 7 Tf ${textStartX} ${pageHeight - 80} Td (Cra 56 # 46-49 Ed. Pompano Of. 901 Medellin  *  www.truccos.com.co) Tj ET\n`;

    // Right Header Badge Card (Folio & Date)
    const badgeX = 390;
    const badgeW = 186;
    const badgeH = 48;
    const badgeY = pageHeight - 85;

    s += "0.98 0.98 0.99 rg\n"; // Soft off-white
    s += "0.85 0.85 0.88 RG 0.6 w\n";
    s += `${badgeX} ${badgeY} ${badgeW} ${badgeH} re b\n`;

    // Slate Gray Accent Stripe on card
    s += "0.30 0.35 0.42 rg\n";
    s += `${badgeX} ${badgeY + badgeH - 3} ${badgeW} 3 re f\n`;

    s += "0.04 0.04 0.04 rg\n";
    s += `BT /F2 9.5 Tf ${badgeX + 10} ${badgeY + 30} Td (COTIZACION COMERCIAL) Tj ET\n`;
    s += "0.45 0.45 0.50 rg\n";
    s += `BT /F1 7.5 Tf ${badgeX + 10} ${badgeY + 17} Td (Folio:) Tj ET\n`;
    s += "0.04 0.04 0.04 rg\n";
    s += `BT /F2 8 Tf ${badgeX + 38} ${badgeY + 17} Td (${escapePdf(quotation.quotationNumber)}) Tj ET\n`;
    s += "0.45 0.45 0.50 rg\n";
    s += `BT /F1 7.5 Tf ${badgeX + 10} ${badgeY + 6} Td (Fecha:) Tj ET\n`;
    s += "0.20 0.20 0.25 rg\n";
    s += `BT /F2 7.5 Tf ${badgeX + 44} ${badgeY + 6} Td (${escapePdf(quotation.dateFormatted)}) Tj ET\n`;
    s += "Q\n";

    // Divider rule
    s += "q\n";
    s += "0.88 0.88 0.90 RG 0.5 w\n";
    s += `${marginLeft} ${pageHeight - 95} m ${marginRight} ${pageHeight - 95} l S\n`;
    s += "Q\n";

    let currentY = pageHeight - 105;

    // 3. Info Cards (First page only)
    if (isFirstPage) {
      const cardH = 50;
      const leftW = 296;
      const rightX = 344;
      const rightW = 232;

      s += "q\n";
      // Left Card: Customer & Advisor Info
      s += "0.98 0.98 0.99 rg\n";
      s += "0.86 0.86 0.89 RG 0.6 w\n";
      s += `${marginLeft} ${currentY - cardH} ${leftW} ${cardH} re b\n`;

      s += "0.04 0.04 0.04 rg\n";
      s += `BT /F2 7.5 Tf ${marginLeft + 10} ${currentY - 14} Td (INFORMACION DEL CLIENTE) Tj ET\n`;

      s += "0.45 0.45 0.50 rg\n";
      s += `BT /F1 7.5 Tf ${marginLeft + 10} ${currentY - 28} Td (Cliente:) Tj ET\n`;
      s += "0.04 0.04 0.04 rg\n";
      const customerText = escapePdf(quotation.customerName);
      const displayCustomer = customerText.length > 34 ? customerText.substring(0, 32) + ".." : customerText;
      s += `BT /F2 8.5 Tf ${marginLeft + 46} ${currentY - 28} Td (${displayCustomer}) Tj ET\n`;

      s += "0.45 0.45 0.50 rg\n";
      s += `BT /F1 7.5 Tf ${marginLeft + 10} ${currentY - 42} Td (Asesor:) Tj ET\n`;
      s += "0.20 0.20 0.25 rg\n";
      const advisorText = escapePdf(quotation.advisorName);
      const displayAdvisor = advisorText.length > 34 ? advisorText.substring(0, 32) + ".." : advisorText;
      s += `BT /F2 8 Tf ${marginLeft + 46} ${currentY - 42} Td (${displayAdvisor}) Tj ET\n`;

      // Right Card: Commercial Conditions (Sophisticated Gray Accent)
      s += "0.965 0.972 0.982 rg\n"; // Soft clean gray background
      s += "0.80 0.83 0.88 RG 0.6 w\n"; // Sleek gray border
      s += `${rightX} ${currentY - cardH} ${rightW} ${cardH} re b\n`;

      s += "0.20 0.25 0.35 rg\n"; // Dark Slate Gray Title
      s += `BT /F2 7.5 Tf ${rightX + 10} ${currentY - 14} Td (CONDICIONES COMERCIALES) Tj ET\n`;

      s += "0.40 0.40 0.45 rg\n";
      s += `BT /F1 7.5 Tf ${rightX + 10} ${currentY - 28} Td (Moneda:) Tj ET\n`;
      s += "0.04 0.04 0.04 rg\n";
      s += `BT /F2 8 Tf ${rightX + 50} ${currentY - 28} Td (${escapePdf(currencyBadgeText)}) Tj ET\n`;

      s += "0.40 0.40 0.45 rg\n";
      s += `BT /F1 7.5 Tf ${rightX + 10} ${currentY - 42} Td (Resumen:) Tj ET\n`;
      s += "0.20 0.25 0.35 rg\n";
      s += `BT /F2 8 Tf ${rightX + 50} ${currentY - 42} Td (${quotation.totalReferences} refs  *  ${quotation.totalUnits} unidades en total) Tj ET\n`;
      s += "Q\n";

      currentY -= cardH + 12;
    }

    // 4. Products Table Headers (Deep Noir #0D0D10 with subtle slate gray underline)
    const colX = {
      num: 36, // w: 22 -> 58
      ref: 58, // w: 74 -> 132
      desc: 132, // w: 168 -> 300
      col: 300, // w: 86 -> 386
      talla: 386, // w: 34 -> 420
      cant: 420, // w: 36 -> 456
      unit: 456, // w: 60 -> 516
      tot: 516, // w: 60 -> 576
    };

    const headerH = 19;
    s += "q\n";
    s += "0.05 0.05 0.06 rg\n"; // Deep Noir #0D0D10
    s += `${marginLeft} ${currentY - headerH} ${usableWidth} ${headerH} re f\n`;

    // Slate Gray accent line under table header
    s += "0.35 0.40 0.48 rg\n";
    s += `${marginLeft} ${currentY - headerH} ${usableWidth} 1.5 re f\n`;

    s += "1 1 1 rg\n";
    s += `BT /F2 7 Tf ${colX.num + 6} ${currentY - 13} Td (#) Tj ET\n`;
    s += `BT /F2 7 Tf ${colX.ref + 4} ${currentY - 13} Td (REFERENCIA) Tj ET\n`;
    s += `BT /F2 7 Tf ${colX.desc + 4} ${currentY - 13} Td (DESCRIPCION / PRENDA) Tj ET\n`;
    s += `BT /F2 7 Tf ${colX.col + 4} ${currentY - 13} Td (COLOR) Tj ET\n`;
    s += `BT /F2 7 Tf ${colX.talla + 4} ${currentY - 13} Td (TALLA) Tj ET\n`;
    s += `BT /F2 7 Tf ${colX.cant + 6} ${currentY - 13} Td (CANT) Tj ET\n`;
    s += `BT /F2 7 Tf ${colX.unit + 14} ${currentY - 13} Td (P. UNIT) Tj ET\n`;
    s += `BT /F2 7 Tf ${colX.tot + 20} ${currentY - 13} Td (TOTAL) Tj ET\n`;
    s += "Q\n";

    currentY -= headerH;

    // 5. Table Rows
    const rowsThisPage = isFirstPage ? rowsPerPageFirst : rowsPerPageNext;
    const pageItemEnd = Math.min(totalItems, itemIndex + rowsThisPage);
    const rowH = 17;

    for (let i = itemIndex; i < pageItemEnd; i++) {
      const it = quotation.items[i];
      const isZebra = i % 2 === 1;

      s += "q\n";
      if (isZebra) {
        s += "0.975 0.978 0.985 rg\n"; // Subtle stripe
        s += `${marginLeft} ${currentY - rowH} ${usableWidth} ${rowH} re f\n`;
      }

      // Hairline row separator
      s += "0.90 0.90 0.92 RG 0.4 w\n";
      s += `${marginLeft} ${currentY - rowH} m ${marginRight} ${currentY - rowH} l S\n`;

      // Index (#)
      s += "0.50 0.50 0.55 rg\n";
      s += `BT /F1 7 Tf ${colX.num + 7} ${currentY - 11.5} Td (${i + 1}) Tj ET\n`;

      // Reference
      s += "0.04 0.04 0.04 rg\n";
      s += `BT /F2 7.5 Tf ${colX.ref + 4} ${currentY - 11.5} Td (${escapePdf(it.referencia)}) Tj ET\n`;

      // Description (clean truncation with safe char limit)
      const descClean = it.descripcion.length > 32 ? it.descripcion.substring(0, 30) + ".." : it.descripcion;
      s += "0.15 0.15 0.18 rg\n";
      s += `BT /F1 7.5 Tf ${colX.desc + 4} ${currentY - 11.5} Td (${escapePdf(descClean)}) Tj ET\n`;

      // Color (expanded 86pt width)
      const colClean = it.color.length > 18 ? it.color.substring(0, 16) + ".." : it.color;
      s += "0.25 0.25 0.30 rg\n";
      s += `BT /F1 7.5 Tf ${colX.col + 4} ${currentY - 11.5} Td (${escapePdf(colClean)}) Tj ET\n`;

      // Talla (Centered)
      s += "0.04 0.04 0.04 rg\n";
      const tallaStr = escapePdf(it.talla);
      const tallaX = colX.talla + 17 - tallaStr.length * 2.2;
      s += `BT /F2 7.5 Tf ${tallaX} ${currentY - 11.5} Td (${tallaStr}) Tj ET\n`;

      // Cantidad (Centered bold)
      const cantStr = String(it.cantidad);
      const cantX = colX.cant + 18 - cantStr.length * 2.5;
      s += `BT /F2 8 Tf ${cantX} ${currentY - 11.5} Td (${cantStr}) Tj ET\n`;

      // P. Unitario (Right-aligned)
      const pUnitStr = escapePdf(it.formattedUnitPrice);
      const pUnitX = 512 - pUnitStr.length * 4.3;
      s += "0.35 0.35 0.40 rg\n";
      s += `BT /F1 7.5 Tf ${pUnitX} ${currentY - 11.5} Td (${pUnitStr}) Tj ET\n`;

      // Total (Right-aligned, bold black)
      const totStr = escapePdf(it.formattedTotalPrice);
      const totX = 572 - totStr.length * 4.4;
      s += "0.04 0.04 0.04 rg\n";
      s += `BT /F2 7.5 Tf ${totX} ${currentY - 11.5} Td (${totStr}) Tj ET\n`;
      s += "Q\n";

      currentY -= rowH;
    }

    itemIndex = pageItemEnd;

    // 6. Summary Totals Cards (Last page only - STRICT SEPARATION, ZERO OVERLAPPING)
    if (isLastPage) {
      currentY -= 16;
      const sumH = 64;
      const leftW = 308;
      const rightX = 356;
      const rightW = 220;

      s += "q\n";
      // Left Card: Observaciones & Términos
      s += "0.98 0.98 0.99 rg\n";
      s += "0.86 0.86 0.89 RG 0.6 w\n";
      s += `${marginLeft} ${currentY - sumH} ${leftW} ${sumH} re b\n`;

      s += "0.25 0.25 0.30 rg\n";
      s += `BT /F2 7 Tf ${marginLeft + 10} ${currentY - 14} Td (OBSERVACIONES Y CONDICIONES COMERCIALES) Tj ET\n`;

      s += "0.45 0.45 0.50 rg\n";
      const notesClean = escapePdf(quotation.notes);
      const notesDisplay = notesClean.length > 55 ? notesClean.substring(0, 53) + ".." : notesClean;
      s += `BT /F1 6.8 Tf ${marginLeft + 10} ${currentY - 26} Td (* ${notesDisplay}) Tj ET\n`;
      s += `BT /F1 6.8 Tf ${marginLeft + 10} ${currentY - 37} Td (* Precios y unidades sujetos a rotacion fisica de inventario.) Tj ET\n`;
      s += `BT /F1 6.8 Tf ${marginLeft + 10} ${currentY - 48} Td (* Calculo comercial: Unidades multiplicadas por el valor en ${quotation.currency}.) Tj ET\n`;

      // Right Card: Luxury Noir Card (#0B0B0B) with Slate Gray Accent
      s += "0.05 0.05 0.06 rg\n"; // Deep Noir #0D0D10
      s += `${rightX} ${currentY - sumH} ${rightW} ${sumH} re f\n`;

      // Top Slate Gray Stripe on total card
      s += "0.45 0.50 0.58 rg\n"; // Slate Gray
      s += `${rightX} ${currentY - 3} ${rightW} 3 re f\n`;

      // Row 1: Unidades
      s += "0.75 0.75 0.80 rg\n";
      s += `BT /F1 7.5 Tf ${rightX + 12} ${currentY - 17} Td (UNIDADES SELECCIONADAS:) Tj ET\n`;
      s += "1 1 1 rg\n";
      const unitsStr = `${quotation.totalUnits} uds.`;
      const unitsX = rightX + rightW - 12 - unitsStr.length * 4.8;
      s += `BT /F2 8.5 Tf ${unitsX} ${currentY - 17} Td (${unitsStr}) Tj ET\n`;

      // Row 2: Referencias
      s += "0.75 0.75 0.80 rg\n";
      s += `BT /F1 7.5 Tf ${rightX + 12} ${currentY - 29} Td (TOTAL MODELOS / REFS:) Tj ET\n`;
      s += "1 1 1 rg\n";
      const refsStr = `${quotation.totalReferences} modelos`;
      const refsX = rightX + rightW - 12 - refsStr.length * 4.8;
      s += `BT /F2 8.5 Tf ${refsX} ${currentY - 29} Td (${refsStr}) Tj ET\n`;

      // Hairline divider in card
      s += "0.20 0.20 0.25 RG 0.5 w\n";
      s += `${rightX + 12} ${currentY - 35} m ${rightX + rightW - 12} ${currentY - 35} l S\n`;

      // Row 3: Grand Total
      s += "0.90 0.90 0.95 rg\n";
      s += `BT /F2 8.5 Tf ${rightX + 12} ${currentY - 50} Td (TOTAL COTIZACION:) Tj ET\n`;

      s += "1 1 1 rg\n"; // Crisp pure white amount
      const totGrandStr = escapePdf(quotation.formattedTotal);
      const totGrandX = rightX + rightW - 12 - totGrandStr.length * 7.2;
      s += `BT /F2 13 Tf ${totGrandX} ${currentY - 51} Td (${totGrandStr}) Tj ET\n`;
      s += "Q\n";
    }

    // 7. Footer
    s += "q\n";
    s += "0.88 0.88 0.90 RG 0.5 w\n";
    s += `${marginLeft} 45 m ${marginRight} 45 l S\n`;
    s += "0.50 0.50 0.55 rg\n";
    s += `BT /F1 6.5 Tf ${marginLeft} 33 Td (Trucco's Jeans  *  Comercial Truccos S.A.S.  *  NIT 900.228.614-1  *  Medellin, Colombia  *  www.truccos.com.co) Tj ET\n`;
    s += `BT /F2 6.5 Tf ${marginRight - 65} 33 Td (Pagina ${pageNum} de ${totalPages}) Tj ET\n`;
    s += "Q\n";

    pageStreams.push(s);
  }

  // Build PDF document objects:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5: Image XObject (ImLogo)
  // 6.. : Page and Stream objects

  const catalogObjIndex = 1;
  const pagesObjIndex = 2;
  const fontF1ObjIndex = 3;
  const fontF2ObjIndex = 4;
  const imageObjIndex = 5;

  const fontF1 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  const fontF2 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  const pageObjectIndices: number[] = [];
  const streamObjectIndices: number[] = [];

  let nextObjIndex = 6;
  for (let i = 0; i < totalPages; i++) {
    pageObjectIndices.push(nextObjIndex++);
    streamObjectIndices.push(nextObjIndex++);
  }

  const pagesKids = pageObjectIndices.map((idx) => `${idx} 0 R`).join(" ");
  const pagesObj = `<< /Type /Pages /Kids [${pagesKids}] /Count ${totalPages} >>`;
  const catalogObj = `<< /Type /Catalog /Pages ${pagesObjIndex} 0 R >>`;

  // Image XObject header and stream
  const imageHeader = `<< /Type /XObject /Subtype /Image /Width ${TRUCCOS_LOGO_WIDTH} /Height ${TRUCCOS_LOGO_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`;

  const objBuffers: Uint8Array[] = [];

  function setStringObj(index: number, content: string) {
    objBuffers[index - 1] = stringToUint8Array(`${index} 0 obj\n${content}\nendobj\n`);
  }

  setStringObj(catalogObjIndex, catalogObj);
  setStringObj(pagesObjIndex, pagesObj);
  setStringObj(fontF1ObjIndex, fontF1);
  setStringObj(fontF2ObjIndex, fontF2);

  // Store Image Object as binary Uint8Array
  objBuffers[imageObjIndex - 1] = concatUint8Arrays([
    stringToUint8Array(`${imageObjIndex} 0 obj\n${imageHeader}`),
    jpegBuffer,
    stringToUint8Array("\nendstream\nendobj\n"),
  ]);

  for (let i = 0; i < totalPages; i++) {
    const pageObjIdx = pageObjectIndices[i];
    const streamObjIdx = streamObjectIndices[i];
    const streamContent = pageStreams[i];
    const streamBytes = stringToUint8Array(streamContent).length;

    const pageObj = `<< /Type /Page /Parent ${pagesObjIndex} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontF1ObjIndex} 0 R /F2 ${fontF2ObjIndex} 0 R >> /XObject << /ImLogo ${imageObjIndex} 0 R >> >> /Contents ${streamObjIdx} 0 R >>`;
    const streamObj = `<< /Length ${streamBytes} >>\nstream\n${streamContent}\nendstream`;

    setStringObj(pageObjIdx, pageObj);
    setStringObj(streamObjIdx, streamObj);
  }

  // Assemble full PDF with binary offsets
  const headerBuf = stringToUint8Array("%PDF-1.4\n");
  const offsets: number[] = [];
  let currentOffset = headerBuf.length;

  for (let i = 0; i < objBuffers.length; i++) {
    offsets.push(currentOffset);
    currentOffset += objBuffers[i].length;
  }

  const startxref = currentOffset;
  let xref = `xref\n0 ${objBuffers.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }

  const trailer = `trailer\n<< /Size ${objBuffers.length + 1} /Root ${catalogObjIndex} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  const trailerBuf = stringToUint8Array(xref + trailer);

  const finalPdfArray = concatUint8Arrays([headerBuf, ...objBuffers, trailerBuf]);
  return new Blob([finalPdfArray.buffer as ArrayBuffer], { type: "application/pdf" });
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
      <td style="padding: 7px 8px; font-size: 11px; text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="padding: 7px 8px; font-size: 11px; font-weight: bold; font-family: monospace; color: #0f172a;">${it.referencia}</td>
      <td style="padding: 7px 8px; font-size: 11px; color: #1e293b;">${it.descripcion}</td>
      <td style="padding: 7px 8px; font-size: 11px; color: #334155;">${it.color}</td>
      <td style="padding: 7px 8px; font-size: 11px; text-align: center; font-weight: 600; color: #0f172a;">${it.talla}</td>
      <td style="padding: 7px 8px; font-size: 11px; text-align: center; font-weight: bold; color: #0f172a;">${it.cantidad}</td>
      <td style="padding: 7px 8px; font-size: 11px; text-align: right; color: #475569;">${it.formattedUnitPrice}</td>
      <td style="padding: 7px 8px; font-size: 11px; text-align: right; font-weight: bold; color: #0f172a;">${it.formattedTotalPrice}</td>
    </tr>
  `
    )
    .join("");

  const printHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Cotización ${quotation.quotationNumber} - Trucco's Jeans</title>
    <style>
      @page { size: letter; margin: 10mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #0b0b0b;
        margin: 0;
        padding: 24px;
        background-color: #ffffff;
      }
      .brand-accent {
        height: 4px;
        background: #475569;
        border-radius: 2px;
        margin-bottom: 16px;
      }
      .header-wrap {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-bottom: 16px;
        border-bottom: 1px solid #e5e7eb;
      }
      .brand-title {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .brand-logo-img {
        height: 44px;
        width: auto;
        object-fit: contain;
      }
      .brand-title h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 900;
        letter-spacing: -0.5px;
        color: #0b0b0b;
      }
      .brand-title .subtitle {
        margin: 3px 0 2px 0;
        font-size: 11px;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.5px;
      }
      .brand-title .address {
        margin: 0;
        font-size: 10px;
        color: #6b7280;
      }
      .folio-card {
        border: 1px solid #e5e7eb;
        border-top: 3px solid #475569;
        border-radius: 6px;
        padding: 10px 14px;
        background: #f8f9fa;
        min-width: 200px;
        text-align: right;
      }
      .folio-card h2 {
        margin: 0 0 6px 0;
        font-size: 12px;
        font-weight: 800;
        color: #0b0b0b;
        letter-spacing: 0.5px;
      }
      .folio-card p {
        margin: 2px 0;
        font-size: 11px;
        color: #4b5563;
      }
      .folio-card strong {
        color: #0b0b0b;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1.3fr 1fr;
        gap: 16px;
        margin: 16px 0 20px 0;
      }
      .info-box {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 12px 16px;
        background: #f8f9fa;
      }
      .info-box.highlight {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      .info-box h3 {
        margin: 0 0 8px 0;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #0b0b0b;
      }
      .info-box.highlight h3 {
        color: #334155;
      }
      .info-box p {
        margin: 3px 0;
        font-size: 11.5px;
        color: #374151;
      }
      .info-box p strong {
        color: #0b0b0b;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th {
        background: #0b0b0b;
        color: #ffffff;
        padding: 8px 10px;
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid #475569;
      }
      .summary-wrap {
        margin-top: 20px;
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 16px;
        align-items: stretch;
      }
      .obs-card {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 12px 16px;
        background: #f8f9fa;
      }
      .obs-card h4 {
        margin: 0 0 8px 0;
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        color: #374151;
        letter-spacing: 0.5px;
      }
      .obs-card p {
        margin: 3px 0;
        font-size: 10px;
        color: #6b7280;
        line-height: 1.4;
      }
      .total-card {
        background: #0b0b0b;
        border-top: 3px solid #64748b;
        color: #ffffff;
        padding: 14px 18px;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .total-card .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        font-size: 11px;
        color: #9ca3af;
      }
      .total-card .row strong {
        color: #ffffff;
      }
      .total-card .divider {
        height: 1px;
        background: #1f2937;
        margin: 6px 0 8px 0;
      }
      .total-card .grand-total-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .total-card .grand-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #e5e7eb;
      }
      .total-card .grand-amount {
        font-size: 22px;
        font-weight: 800;
        color: #ffffff;
      }
      .footer-note {
        margin-top: 28px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        font-size: 9.5px;
        color: #9ca3af;
        display: flex;
        justify-content: space-between;
      }
      @media print {
        body { padding: 0; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="no-print" style="margin-bottom: 20px; display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: #0f172a; color: white; border: none; padding: 10px 22px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">
        🖨️ Imprimir Cotización
      </button>
      <button onclick="window.close()" style="background: #f3f4f6; color: #1f2937; border: 1px solid #d1d5db; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">
        Cerrar
      </button>
    </div>

    <div class="brand-accent"></div>

    <div class="header-wrap">
      <div class="brand-title">
        <img class="brand-logo-img" src="data:image/jpeg;base64,${TRUCCOS_LOGO_JPEG_BASE64}" alt="Trucco's Jeans" />
        <div>
          <h1>TRUCCO'S JEANS</h1>
          <div class="subtitle">COMERCIAL TRUCCOS S.A.S. &nbsp;|&nbsp; NIT 900.228.614-1</div>
          <p class="address">Cra 56 # 46-49 Ed. Pompano Of. 901, Medellín · PBX: (+57) 314 865 1454 · www.truccos.com.co</p>
        </div>
      </div>
      <div class="folio-card">
        <h2>COTIZACIÓN COMERCIAL</h2>
        <p>Folio: <strong>${quotation.quotationNumber}</strong></p>
        <p>Fecha: <strong>${quotation.dateFormatted}</strong></p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>Información del Cliente</h3>
        <p><strong>Cliente:</strong> ${quotation.customerName}</p>
        <p><strong>Asesor Comercial:</strong> ${quotation.advisorName}</p>
        <p><strong>Vigencia:</strong> 15 días calendario</p>
      </div>
      <div class="info-box highlight">
        <h3>Condiciones Comerciales</h3>
        <p><strong>Moneda:</strong> ${currencyBadge}</p>
        <p><strong>Resumen:</strong> ${quotation.totalReferences} modelos &nbsp;·&nbsp; ${quotation.totalUnits} prendas totales</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 24px; text-align: center;">#</th>
          <th style="text-align: left; width: 85px;">Referencia</th>
          <th style="text-align: left;">Descripción / Prenda</th>
          <th style="text-align: left; width: 110px;">Color</th>
          <th style="text-align: center; width: 45px;">Talla</th>
          <th style="text-align: center; width: 45px;">Cant</th>
          <th style="text-align: right; width: 80px;">P. Unit</th>
          <th style="text-align: right; width: 90px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="summary-wrap">
      <div class="obs-card">
        <h4>Observaciones y Condiciones Comerciales</h4>
        <p>• ${quotation.notes}</p>
        <p>• Precios y disponibilidad física de prendas sujetos a confirmación en bodega al momento de la orden.</p>
        <p>• Precios calculados multiplicando unidades por su valor unitario en ${quotation.currency}.</p>
      </div>
      <div class="total-card">
        <div>
          <div class="row">
            <span>UNIDADES SELECCIONADAS:</span>
            <strong>${quotation.totalUnits} uds.</strong>
          </div>
          <div class="row">
            <span>MODELOS / REFERENCIAS:</span>
            <strong>${quotation.totalReferences} refs.</strong>
          </div>
        </div>
        <div>
          <div class="divider"></div>
          <div class="grand-total-row">
            <span class="grand-title">TOTAL COTIZACIÓN:</span>
            <span class="grand-amount">${quotation.formattedTotal}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-note">
      <span>Trucco's Jeans · Comercial Truccos S.A.S. · NIT 900.228.614-1 · Medellín, Colombia</span>
      <span>www.truccos.com.co</span>
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
