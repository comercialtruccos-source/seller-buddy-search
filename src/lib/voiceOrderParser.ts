import { InventoryRow } from "./inventory";

export interface ParsedVoiceCommand {
  intent: "ADD" | "REMOVE" | "CLEAR" | "SET_CLIENT" | "SAVE" | "EXPORT" | "UNKNOWN";
  rawText: string;
  quantity?: number;
  referencia?: string;
  color?: string;
  talla?: string;
  clientName?: string;
  matchedItems?: InventoryRow[];
  feedbackMessage: string;
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  doce: 12,
  quince: 15,
  veinte: 20,
  treinta: 30,
  cincuenta: 50,
  cien: 100,
};

function extractQuantity(text: string): number {
  // First look for explicit digits
  const digitMatch = text.match(/\b(\d+)\b/);
  if (digitMatch) {
    return parseInt(digitMatch[1], 10);
  }

  // Look for number words
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (NUMBER_WORDS[word] !== undefined) {
      return NUMBER_WORDS[word];
    }
  }

  return 1; // default quantity
}

export function parseVoiceOrderCommand(
  speechText: string,
  inventory: InventoryRow[]
): ParsedVoiceCommand {
  const text = speechText.trim();
  const lower = text.toLowerCase();

  // 1. CLEAR ORDER
  if (
    lower.includes("vaciar pedido") ||
    lower.includes("limpiar pedido") ||
    lower.includes("borrar pedido") ||
    lower.includes("vaciar el pedido")
  ) {
    return {
      intent: "CLEAR",
      rawText: text,
      feedbackMessage: "Pedido vaciado correctamente.",
    };
  }

  // 2. SAVE ORDER
  if (
    lower.includes("guardar pedido") ||
    lower.includes("guardar el pedido") ||
    lower.includes("finalizar pedido") ||
    lower.includes("confirmar pedido")
  ) {
    return {
      intent: "SAVE",
      rawText: text,
      feedbackMessage: "Guardando pedido en la base de datos...",
    };
  }

  // 3. EXPORT EXCEL
  if (
    lower.includes("descargar excel") ||
    lower.includes("exportar excel") ||
    lower.includes("generar excel")
  ) {
    return {
      intent: "EXPORT",
      rawText: text,
      feedbackMessage: "Generando y descargando archivo Excel...",
    };
  }

  // 4. SET CLIENT NAME
  const clientMatch = lower.match(
    /(?:cliente|nombre del cliente|para el cliente|para)\s+([a-záéíóúñ0-9\s]+)/i
  );
  if (clientMatch && !lower.includes("agregar") && !lower.includes("quitar")) {
    const clientName = clientMatch[1]
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
      .trim();

    return {
      intent: "SET_CLIENT",
      rawText: text,
      clientName,
      feedbackMessage: `Cliente asignado: "${clientName}".`,
    };
  }

  // 5. REMOVE ITEM
  if (lower.startsWith("quitar") || lower.startsWith("eliminar") || lower.startsWith("borrar")) {
    const qty = extractQuantity(text);
    const cleanedText = lower
      .replace(/^(quitar|eliminar|borrar)\s+/, "")
      .replace(/\b(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/g, "")
      .replace(/\b(de|la|el|los|las|unidades|unidad)\b/g, "")
      .trim();

    const matches = inventory.filter((item) => {
      const refMatch = item.referencia.toLowerCase().includes(cleanedText);
      const descMatch = item.descripcion.toLowerCase().includes(cleanedText);
      const skuMatch = item.sku.toLowerCase().includes(cleanedText);
      return refMatch || descMatch || skuMatch;
    });

    if (matches.length === 0) {
      return {
        intent: "REMOVE",
        rawText: text,
        feedbackMessage: `No se encontró la referencia "${cleanedText}" para quitar del pedido.`,
      };
    }

    return {
      intent: "REMOVE",
      rawText: text,
      quantity: qty,
      matchedItems: matches,
      feedbackMessage: `Quitando ${qty} unidad(es) de ${matches[0].referencia}.`,
    };
  }

  // 6. ADD ITEM (DEFAULT INTENT)
  const qty = extractQuantity(text);

  // Extract reference code or product query keywords
  // Standard references like B0102, B-0102, etc.
  const refCodeMatch = text.match(/\b([A-Za-z]\s*0?\d{3,4}|[A-Za-z]\d+)\b/);
  const targetRef = refCodeMatch ? refCodeMatch[1].replace(/\s+/g, "").toUpperCase() : null;

  // Extract colors
  const colors = [
    "azul", "negro", "blanco", "rojo", "verde", "amarillo", "rosa",
    "fucsia", "naranja", "cafe", "marrón", "gris", "crudo", "beige", "arena"
  ];
  const foundColor = colors.find((c) => lower.includes(c));

  // Extract tallas
  const tallas = ["xs", "s", "m", "l", "xl", "xxl", "28", "30", "32", "34", "36", "38", "40"];
  const tallaMatch = lower.match(/\btalla\s+([a-z0-9]+)\b/) || lower.match(/\b(xs|s|m|l|xl|xxl|28|30|32|34|36|38|40)\b/);
  const foundTalla = tallaMatch ? tallaMatch[1].toUpperCase() : null;

  // Filter inventory candidates
  let candidates = inventory;

  if (targetRef) {
    candidates = candidates.filter((i) => i.referencia.toUpperCase().includes(targetRef));
  } else {
    // Clean text for search query
    const searchTerms = lower
      .replace(/\b(agregar|añadir|poner|quiero|dame|unidades|unidad|talla|color)\b/g, "")
      .replace(/\b(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/g, "")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1);

    if (searchTerms.length > 0) {
      candidates = candidates.filter((item) => {
        const fullStr = `${item.referencia} ${item.descripcion} ${item.color} ${item.talla}`.toLowerCase();
        return searchTerms.some((term) => fullStr.includes(term));
      });
    }
  }

  if (foundColor) {
    const colorMatches = candidates.filter((i) => i.color.toLowerCase().includes(foundColor));
    if (colorMatches.length > 0) candidates = colorMatches;
  }

  if (foundTalla) {
    const tallaMatches = candidates.filter((i) => i.talla.toUpperCase() === foundTalla);
    if (tallaMatches.length > 0) candidates = tallaMatches;
  }

  if (candidates.length === 0) {
    return {
      intent: "UNKNOWN",
      rawText: text,
      feedbackMessage: `No se encontraron productos en el inventario para: "${text}".`,
    };
  }

  const selectedItem = candidates[0];

  return {
    intent: "ADD",
    rawText: text,
    quantity: qty,
    referencia: selectedItem.referencia,
    color: selectedItem.color,
    talla: selectedItem.talla,
    matchedItems: candidates,
    feedbackMessage: `Agregado ${qty} unidad(es) de ${selectedItem.referencia} (${selectedItem.color} - Talla ${selectedItem.talla}).`,
  };
}
