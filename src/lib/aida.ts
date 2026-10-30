export function getModelSize(referencia: string): string {
  const ref = (referencia || "").trim().toUpperCase();
  if (ref.startsWith("P")) return "XL";
  if (ref.startsWith("B") || ref.startsWith("T")) return "S";
  return "08";
}

export interface AIDAStructure {
  archetype: string;
  atencion: string;
  interes: string;
  deseo: string;
  accion: string;
  fullHTML: string;
  fullText: string;
}

export function parseProductMicroDetails(nombre: string = ""): {
  category: string;
  neckline?: string;
  sleeves?: string;
  accents: string[];
  silhouette?: string;
} {
  const n = (nombre || "").toLowerCase();
  const accents: string[] = [];

  let category = "Prenda";
  if (n.includes("jean")) category = "Jean";
  else if (n.includes("blusa")) category = "Blusa";
  else if (n.includes("pantalon") || n.includes("pantalón")) category = "Pantalón";
  else if (n.includes("chamarra") || n.includes("chaqueta") || n.includes("jacket")) category = "Chaqueta";
  else if (n.includes("chaleco") || n.includes("vest")) category = "Chaleco";
  else if (n.includes("vestido") || n.includes("dress")) category = "Vestido";
  else if (n.includes("enterizo") || n.includes("jumpsuit")) category = "Enterizo";
  else if (n.includes("falda") || n.includes("skirt")) category = "Falda";
  else if (n.includes("short") || n.includes("bermuda")) category = "Short";
  else if (n.includes("top") || n.includes("crop")) category = "Top";
  else if (n.includes("camisa") || n.includes("camisera")) category = "Camisa";
  else if (n.includes("buzo") || n.includes("saco") || n.includes("hoodie")) category = "Buzo";
  else if (n.includes("blazer") || n.includes("cardigan")) category = "Blazer";

  let neckline: string | undefined;
  if (n.includes("escote en v") || n.includes("escote v")) neckline = "escote en V";
  else if (n.includes("cuello camisero")) neckline = "cuello camisero";
  else if (n.includes("cuello alto") || n.includes("tortuga")) neckline = "cuello alto";
  else if (n.includes("escote cruzado")) neckline = "escote cruzado";
  else if (n.includes("cuello redondo")) neckline = "cuello redondo";
  else if (n.includes("escote bandeja") || n.includes("barco")) neckline = "escote bandeja";
  else if (n.includes("cuello halter") || n.includes("halter")) neckline = "cuello halter";
  else if (n.includes("cuello asimetrico") || n.includes("asimétrico")) neckline = "cuello asimétrico";

  let sleeves: string | undefined;
  if (n.includes("manga corta")) sleeves = "manga corta";
  else if (n.includes("manga larga")) sleeves = "manga larga";
  else if (n.includes("sisa") || n.includes("sin manga")) sleeves = "sisa";
  else if (n.includes("manga 3/4")) sleeves = "manga 3/4";
  else if (n.includes("manga bombacha") || n.includes("manga abullonada")) sleeves = "manga bombacha";
  else if (n.includes("manga campana") || n.includes("manga flare")) sleeves = "manga campana";

  if (n.includes("perla")) accents.push("detalles de perlas");
  if (n.includes("brillo") || n.includes("lurex") || n.includes("lúrex")) accents.push("acabado con destellos de brillo");
  if (n.includes("tacha") || n.includes("remache")) accents.push("aplicaciones de tachas metálicas");
  if (n.includes("bordado")) accents.push("bordado artesanal exclusivo");
  if (n.includes("encaje") || n.includes("blonda")) accents.push("detalles en encaje");
  if (n.includes("estampado") || n.includes("print")) accents.push("estampado de temporada");
  if (n.includes("lazo") || n.includes("amarradura") || n.includes("cinturón")) accents.push("lazo ajustable");
  if (n.includes("rotura") || n.includes("destroy") || n.includes("roto")) accents.push("detalles destruidos de tendencia");
  if (n.includes("cierre") || n.includes("cremallera")) accents.push("cierre frontal visible");
  if (n.includes("desflecado") || n.includes("ruedo")) accents.push("ruedo desflecado");
  if (n.includes("pinza") || n.includes("levanta cola") || n.includes("push up")) accents.push("sistema levanta cola");

  let silhouette: string | undefined;
  if (n.includes("bota ancha")) silhouette = "corte bota ancha";
  else if (n.includes("bota recta") || n.includes("recto")) silhouette = "corte bota recta";
  else if (n.includes("wide leg")) silhouette = "silueta wide leg de tiro alto";
  else if (n.includes("skinny") || n.includes("tubo")) silhouette = "corte ajustado skinny";
  else if (n.includes("flare") || n.includes("campana")) silhouette = "silueta flare acampanada";
  else if (n.includes("mom") || n.includes("mom fit")) silhouette = "silueta mom fit clásica";
  else if (n.includes("cargo")) silhouette = "estilo cargo con bolsillos utilitarios";
  else if (n.includes("jogger")) silhouette = "silueta jogger deportiva";
  else if (n.includes("oversize") || n.includes("holgado")) silhouette = "silueta oversize de calce holgado";
  else if (n.includes("plus size")) silhouette = "corte Plus Size anatómico";

  return { category, neckline, sleeves, accents, silhouette };
}

export function generateAIDAStructure(
  nombre: string,
  referencia: string,
  composicion?: string
): AIDAStructure {
  const ref = (referencia || "").trim().toUpperCase();
  const rawNombre = (nombre || "").trim();
  const nombreClean = rawNombre
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ") || `Prenda REF ${ref}`;

  const micro = parseProductMicroDetails(rawNombre || nombreClean);
  const tallaMod = getModelSize(ref);

  let defaultComp = "100% Algodón Premium";
  if (micro.category === "Jean" || micro.category === "Chaqueta" || micro.category === "Chaleco") {
    defaultComp = "Denim Confort Strech (98% Algodón, 2% Elastano)";
  } else if (micro.category === "Blusa" || micro.category === "Top" || micro.category === "Camisa") {
    defaultComp = "Chalis Suave & Algodón Transpirable";
  } else if (micro.category === "Vestido") {
    defaultComp = "Tejido Fluido de Gran Caída";
  }

  const compClean = (composicion || "").trim() || defaultComp;
  const mood = "Colección Tendencias Trucco's Denim";
  const occ = "Uso Diario & Casual Chic";
  const st = "Combínalo fácilmente con tus prendas superiores o denim favoritos para un look impecable.";

  const featureParts: string[] = [];
  if (micro.silhouette) featureParts.push(micro.silhouette);
  if (micro.neckline) featureParts.push(`con ${micro.neckline}`);
  if (micro.sleeves) featureParts.push(micro.sleeves);
  if (micro.accents.length) featureParts.push(`y ${micro.accents.join(", ")}`);

  const specificFeatureDesc = featureParts.length ? featureParts.join(" ") : "con confección anatómica y detalles de tendencia";

  // A.I.D.A. Blocks
  const atencion = `Descubre el ${nombreClean} (REF ${ref}), diseñado con ${specificFeatureDesc}. Una pieza protagonista pensada para estilizar tu figura dentro de la ${mood}.`;
  const interes = `Confeccionada en ${compClean}, ofrece un tacto suave de máxima frescura y la elasticidad justa para total libertad de movimiento. Conserva su horma y color lavado tras lavado.`;
  const deseo = `Ideal para lucir en ${occ}. Su patronaje exclusivo abraza tus curvas y realza tu silueta brindando comodidad ininterrumpida todo el día. ${st}`;
  const accion = `¡Añádelo a tu guardarropa antes de que se agote! Consulta disponibilidad en tus tallas y colores preferidos para confirmar tu pedido hoy mismo.`;

  const fullHTML = `<div class="aida-description">
  <p class="aida-atencion"><strong>${atencion}</strong></p>
  <p class="aida-interes">${interes}</p>
  <p class="aida-deseo">${deseo}</p>
  <p class="aida-accion"><strong>${accion}</strong></p>
  <hr />
  <p><strong>REFERENCIA:</strong> ${ref}</p>
  <p><strong>COMPOSICIÓN:</strong> ${compClean}</p>
  <p><strong>COLECCIÓN:</strong> ${mood}</p>
  <p><strong>TALLA DE MODELO:</strong> Talla ${tallaMod}</p>
</div>`;

  const fullText = `🌟 *${nombreClean}* (REF ${ref})\n\n` +
    `🎯 *Atención:* ${atencion}\n\n` +
    `💡 *Interés:* ${interes}\n\n` +
    `✨ *Deseo:* ${deseo}\n\n` +
    `🛍️ *Acción:* ${accion}\n\n` +
    `📋 *Detalles Comerciales:*\n` +
    `• *Referencia:* ${ref}\n` +
    `• *Composición:* ${compClean}\n` +
    `• *Colección:* ${mood}\n` +
    `• *Talla Modelo:* ${tallaMod}`;

  return {
    archetype: micro.category,
    atencion,
    interes,
    deseo,
    accion,
    fullHTML,
    fullText,
  };
}
