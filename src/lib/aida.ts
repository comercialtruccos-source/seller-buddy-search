// Generador y parser de descripciones comerciales A.I.D.A.
// Proporciona descripciones únicas, dinámicas y no repetitivas para cada producto.

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick<T>(arr: T[], hash: number, offset = 0): T {
  return arr[(hash + offset) % arr.length];
}

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
  composicion: string;
  tallaModelo: string;
  isFromShopify: boolean;
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
  else if (n.includes("short") || n.includes("bermuda")) category = "Short/Bermuda";
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

// ==========================================
// BANCO DE VARIACIONES DINÁMICAS POR CATEGORÍA
// ==========================================

// JEANS Y PANTALONES (Línea Denim)
const atencionJeans = [
  (n: string, r: string, d: string) => `Lleva tu estilo denim al siguiente nivel con el ${n} (REF ${r})${d ? `, diseñado con ${d}` : ""}. El balance exacto entre tendencia urbana y silueta impecable.`,
  (n: string, r: string, d: string) => `Impacta a primera vista con este ${n} (REF ${r}). Una pieza icónica${d ? ` con ${d}` : ""} pensada para realzar tu presencia con autenticidad.`,
  (n: string, r: string, d: string) => `Tu outfit perfecto empieza aquí: el ${n} (REF ${r}) que estiliza tu figura${d ? ` gracias a su ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Renueva tu colección denim con la fuerza y distinción del ${n} (REF ${r})${d ? `, destacando por su ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Comodidad, horma y actitud: conoce el ${n} (REF ${r})${d ? ` con ${d}` : ""}, creado para mujeres que exigen estilo sin complicaciones.`,
  (n: string, r: string, d: string) => `Descubre el secreto de una figura esculpida con el ${n} (REF ${r})${d ? `, confeccionado con ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Estilo que no pasa desapercibido: el ${n} (REF ${r}) redefine el clásico jean colombiano${d ? ` con ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Haz una declaración de moda en cada paso con el ${n} (REF ${r})${d ? `, luciendo ${d}` : ""}.`,
];

const interesJeans = [
  (c: string) => `Confeccionado en ${c}, su tejido strech de alta recuperación abraza el cuerpo sin perder su forma tras largas jornadas de uso.`,
  (c: string) => `Su composición en ${c} ofrece la mezcla idónea de elasticidad y firmeza, garantizando una horma impecable y gran libertad al caminar.`,
  (c: string) => `Elaborado con ${c}, su textura suave al tacto y costuras reforzadas de alta gama aseguran durabilidad y comodidad desde la primera puesta.`,
  (c: string) => `Gracias a su formulación en ${c}, disfrutarás de una prenda con caída estructurada que acompaña tus movimientos con absoluta naturalidad.`,
  (c: string) => `Fabricado en ${c}, su proceso de lavado artesanal realza el tono y protege la resistencia de las fibras lavado tras lavado.`,
  (c: string) => `El tejido en ${c} brinda una sensación envolvente que no marca ni aprisiona, adaptándose a tu cuerpo con suavidad insuperable.`,
  (c: string) => `Confección premium en ${c} pensada para mantener el color vibrante y el ajuste perfecto en todo momento.`,
  (c: string) => `Su mezcla textil en ${c} asegura frescura, flexibilidad y resistencia extrema para acompañar tu ritmo diario.`,
];

const deseoJeans = [
  () => `Su patronaje levanta cola y cintura anatómica moldean la figura al instante, otorgándote esa silueta estilizada que te llena de seguridad.`,
  () => `Imagínate combinándolo con tus tops favoritos o tacones para una noche especial; su corte favorecedor alarga visualmente las piernas.`,
  () => `Siente la confianza de vestir una prenda que se adapta a ti y celebra tus curvas con elegancia, tanto en el trabajo como el fin de semana.`,
  () => `Es esa prenda comodín imprescindible que resuelve cualquier look con un toque chic y sofisticado sin esfuerzo.`,
  () => `Porque mereces un jean que te haga sentir radiante y poderosa desde el momento en que te miras al espejo.`,
  () => `Un diseño versátil que transiciona con gracia del día a la noche, brindándote porte y sofisticación continua.`,
  () => `Crea outfits memorables con la seguridad de que tu silueta luce definida, cómoda y en plena tendencia.`,
  () => `La prenda perfecta para quienes valoran verse espectaculares sin renunciar a la máxima comodidad en ningún momento.`,
];

const accionJeans = [
  (r: string) => `¡Asegura tu REF ${r} hoy mismo! Consulta existencias por talla y color antes de que se agoten en catálogo.`,
  (r: string) => `Agrégalo a tu pedido y dale a tu guardarropa la renovación que merece con la REF ${r}.`,
  (r: string) => `No dejes pasar esta pieza clave. Solicita la REF ${r} en tus tonos preferidos ahora.`,
  (r: string) => `Haz tuyo el calce perfecto. Pide la REF ${r} y marca la diferencia en cada ocasión.`,
  (r: string) => `Confirma tu pedido de la REF ${r} hoy y disfruta de un estilo inconfundible.`,
  (r: string) => `Unidades limitadas en bodega. Elige tu talla y solicita la REF ${r} ahora mismo.`,
  (r: string) => `¡El momento de estrenar es hoy! Separa la REF ${r} y sorprende con tu estilo.`,
  (r: string) => `Haz clic en pedir y asegura la REF ${r} para tus clientas antes de agotar inventario.`,
];

// BLUSAS, TOPS Y CAMISAS
const atencionBlusas = [
  (n: string, r: string, d: string) => `Frescura, feminidad y elegancia se unen en la ${n} (REF ${r})${d ? `, realzada con ${d}` : ""}. La prenda clave para iluminar tu outfit.`,
  (n: string, r: string, d: string) => `Dale un aire renovado y sofisticado a tu look con la ${n} (REF ${r})${d ? ` con ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Descubre el encanto irresistible de la ${n} (REF ${r})${d ? `, diseñada con ${d}` : ""}, creada para destacar en cualquier ocasión.`,
  (n: string, r: string, d: string) => `Tu nueva prenda protagonista: la ${n} (REF ${r})${d ? ` con sutiles ${d}` : ""} que cautiva con solo mirarla.`,
  (n: string, r: string, d: string) => `Elegancia casual en su máxima expresión con la ${n} (REF ${r})${d ? `, confeccionada con ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Inspira seguridad y delicadeza con esta ${n} (REF ${r})${d ? ` que incorpora ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Añade un toque de distinción a tu día a día con la ${n} (REF ${r})${d ? ` y sus detalles en ${d}` : ""}.`,
  (n: string, r: string, d: string) => `La prenda perfecta para quienes aman el estilo contemporáneo: ${n} (REF ${r})${d ? ` con ${d}` : ""}.`,
];

const interesBlusas = [
  (c: string) => `Elaborada en ${c}, su textura ligera y transpirable acaricia la piel garantizando frescura durante todo el día.`,
  (c: string) => `Su tejido en ${c} cuenta con una caída fluida que se adapta suavemente a la figura sin marcar ni restringir.`,
  (c: string) => `Confección premium en ${c}, pensada para conservar su suavidad, caída y colorido intactos tras cada lavado.`,
  (c: string) => `Su mezcla textil en ${c} ofrece un tacto sedoso y una resistencia notable que la hacen ideal para uso frecuente.`,
  (c: string) => `Fabricada en ${c}, proporciona una sensación envolvente y ligera, perfecta para climas cálidos y templados.`,
  (c: string) => `El acabado de su tejido en ${c} eleva el aspecto de la prenda, haciéndola lucir pulcra, moderna y de alta gama.`,
  (c: string) => `Hecha con ${c}, combina comodidad excepcional con un diseño ergonómico que estiliza los hombros y el escote.`,
  (c: string) => `Gracias a su confección en ${c}, disfrutarás de una prenda con movimiento orgánico y ventilación natural.`,
];

const deseoBlusas = [
  () => `Combínala con jeans de tiro alto o un pantalón formal; siempre proyectarás una imagen pulida, femenina y con clase.`,
  () => `Siente la satisfacción de lucir una pieza versátil que te acompaña de una reunión de trabajo a una cena especial con total naturalidad.`,
  () => `Una prenda que despierta elogios y resalta tu buen gusto en cada detalle, haciéndote sentir radiante y segura.`,
  () => `Esa prenda salvadora en tu armario que combina con todo y eleva instantáneamente cualquier look básico.`,
  () => `Diseñada para realzar tu belleza natural con sutileza, comodidad y un toque de moda actual.`,
  () => `Proyecta la seguridad de la mujer moderna que no renuncia a sentirse fresca y cómoda en ningún momento.`,
  () => `Una pieza que te envuelve en sofisticación y te brinda la libertad de moverte con soltura y glamour.`,
  () => `El secreto para lograr ese look impecable y desenfadado que parece creado sin esfuerzo.`,
];

const accionBlusas = [
  (r: string) => `¡Hazla parte de tu colección hoy! Solicita la REF ${r} en tus colores preferidos.`,
  (r: string) => `No te quedes sin esta prenda imprescindible. Pide la REF ${r} antes de agotar existencias.`,
  (r: string) => `Agrégala a tu pedido ahora y sorprende a tus clientes con la REF ${r}.`,
  (r: string) => `Elige tus tallas favoritas y asegura la REF ${r} en catálogo hoy mismo.`,
  (r: string) => `Renueva tu estilo con la REF ${r}. ¡Solicítala antes de que vuele!`,
  (r: string) => `¡No dejes pasar esta oportunidad! Separa la REF ${r} con entrega inmediata.`,
  (r: string) => `Haz tuyo el toque chic de la temporada. Pide la REF ${r} ahora.`,
  (r: string) => `Consulta disponibilidad y confirma tu pedido de la REF ${r} con un solo clic.`,
];

// PLUS SIZE (Referencias 'P')
const atencionPlus = [
  (n: string, r: string, d: string) => `Descubre el ${n} (REF ${r})${d ? `, diseñado con ${d}` : ""}, pensado especialmente para celebrar y esculpir tus curvas con elegancia.`,
  (n: string, r: string, d: string) => `Moda sin límites ni barreras: el ${n} (REF ${r})${d ? ` con ${d}` : ""} potencia tu figura y confianza al máximo nivel.`,
  (n: string, r: string, d: string) => `Estilo, confort y presencia: luce espectacular con el ${n} (REF ${r})${d ? ` y su ${d}` : ""}, hecho a tu medida.`,
  (n: string, r: string, d: string) => `Viste tu autenticidad con el ${n} (REF ${r})${d ? ` con ${d}` : ""}. Una prenda que entiende tu cuerpo y lo resalta con orgullo.`,
  (n: string, r: string, d: string) => `Curvas poderosas, estilo sublime: el ${n} (REF ${r})${d ? ` diseñado con ${d}` : ""} redefine el calce plus size.`,
  (n: string, r: string, d: string) => `Enamórate de tu silueta con el ${n} (REF ${r})${d ? ` y sus detalles en ${d}` : ""}. Confort y belleza en armonía total.`,
  (n: string, r: string, d: string) => `La prenda que estabas esperando: ${n} (REF ${r})${d ? ` con ${d}` : ""}, creada para mujeres que brillan con luz propia.`,
  (n: string, r: string, d: string) => `Siente la magia de una horma perfecta con el ${n} (REF ${r})${d ? ` que incorpora ${d}` : ""}.`,
];

const interesPlus = [
  (c: string) => `Confeccionado en ${c}, ofrece un calce envolvente que acompaña cada movimiento sin apretar ni marcar.`,
  (c: string) => `Su tejido en ${c} cuenta con la elasticidad ideal para adaptarse a tu anatomía con suavidad y soporte inigualable.`,
  (c: string) => `Elaborado con ${c}, combina costuras anatómicas y control suave que estilizan el abdomen y definen la cintura.`,
  (c: string) => `Su composición en ${c} asegura una prenda duradera, transpirable y resistente que no pierde su horma lavado tras lavado.`,
  (c: string) => `Fabricado en ${c}, su tacto afelpado y ligereza te brindan libertad total de movimiento en todo momento.`,
  (c: string) => `Confección especializada en ${c} que realza los puntos fuertes de tu silueta garantizando soporte y comodidad premium.`,
  (c: string) => `El ${c} seleccionado proporciona una caída estética y un acabado pulido que favorece cada ángulo de tu cuerpo.`,
  (c: string) => `Diseñado en ${c} con tecnología de memoria elástica para mantener el ajuste perfecto durante todo el día.`,
];

const deseoPlus = [
  () => `Porque el buen vestir no tiene talla. Siéntete hermosa, segura y empoderada cada vez que te pongas esta prenda.`,
  () => `Mírate al espejo y redescubre el poder de tus curvas con un corte que estiliza y realza lo mejor de ti.`,
  () => `Una prenda que te brinda la seguridad de lucir impecable en todo momento, celebrando tu belleza real.`,
  () => `Comodidad que se siente, elegancia que se nota. La pieza ideal para quienes buscan verse y sentirse fabulosas.`,
  () => `Dile adiós a las prendas incómodas y dale la bienvenida al diseño pensado exclusivamente para tu bienestar.`,
  () => `Proyecta la fuerza y el encanto de una mujer que sabe lo que vale y viste con orgullo su mejor versión.`,
  () => `Llévala con la certeza de que tu figura luce armoniosa, estilizada y llena de vida en cada paso.`,
  () => `La prenda que se convertirá en tu consentida porque abraza tu cuerpo y resalta tu belleza sin esfuerzo.`,
];

const accionPlus = [
  (r: string) => `¡Hazla tuya hoy! Solicita la REF ${r} en tus tallas plus size antes de agotar existencia.`,
  (r: string) => `Atrévete a lucir espectacular. Pide la REF ${r} y transforma tu experiencia al vestir.`,
  (r: string) => `Agrégala a tu pedido ahora. La REF ${r} es una de las más solicitadas de la colección.`,
  (r: string) => `Separa tu REF ${r} hoy mismo y asegura el mejor calce para tus curvas.`,
  (r: string) => `No te quedes sin tu favorita. Consulta disponibilidad de la REF ${r} ahora.`,
  (r: string) => `¡El momento de brillar es ya! Solicita la REF ${r} en tu catálogo.`,
  (r: string) => `Haz tuyo el confort que mereces con la REF ${r}. ¡Pídela hoy!`,
  (r: string) => `Confirma tu pedido de la REF ${r} y disfruta de una prenda que realmente te entiende.`,
];

// CHAQUETAS, CHALECOS, BLAZERS Y BUZOS
const atencionTerceras = [
  (n: string, r: string, d: string) => `El complemento definitivo para elevar cualquier outfit: ${n} (REF ${r})${d ? `, con ${d}` : ""}. Estructura y carácter en una sola prenda.`,
  (n: string, r: string, d: string) => `Añade un toque de audacia y distinción a tu look con el ${n} (REF ${r})${d ? ` diseñado con ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Protégete del clima con elegancia y vanguardia gracias al ${n} (REF ${r})${d ? ` y su ${d}` : ""}.`,
  (n: string, r: string, d: string) => `La tercera prenda que transforma un look simple en una declaración de moda: ${n} (REF ${r})${d ? ` con ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Estilo contemporáneo y actitud urbana en el ${n} (REF ${r})${d ? `, destacando por su ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Conoce la pieza maestra que completará tus mejores atuendos: ${n} (REF ${r})${d ? ` con ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Versatilidad y sofisticación en capas: el ${n} (REF ${r})${d ? ` confeccionado con ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Diseño atemporal con el sello distintivo de Trucco's: ${n} (REF ${r})${d ? ` y sus ${d}` : ""}.`,
];

const interesTerceras = [
  (c: string) => `Confeccionado en ${c}, su tela aporta la consistencia ideal para mantener una silueta definida con gran confort.`,
  (c: string) => `Su composición en ${c} garantiza resistencia al desgaste, protegiendo del viento y conservando un tacto muy agradable.`,
  (c: string) => `Elaborado con ${c}, incorpora herrajes y acabados premium que aseguran una larga vida útil y presencia impecable.`,
  (c: string) => `Fabricado en ${c}, ofrece un peso balanceado que abriga sin resultar pesado, ideal para usar en capas todo el año.`,
  (c: string) => `Su tejido en ${c} cuenta con acabados minuciosos en cuello, bolsillos y puños para una experiencia de uso superior.`,
  (c: string) => `Hecho con ${c}, resiste lavados y uso intensivo conservando la intensidad del color y la firmeza de su estructura.`,
  (c: string) => `La calidad de su ${c} se percibe al instante: un tejido prémium con textura uniforme y calce anatómico.`,
  (c: string) => `Su mezcla textil en ${c} brinda flexibilidad y adaptabilidad para que lo lleves sobre tops, camisas o buzos con comodidad.`,
];

const deseoTerceras = [
  () => `Llévalo abierto para un aire desenfadado o cerrado para un estilo más formal; siempre proyectarás seguridad y autoridad de estilo.`,
  () => `Esa prenda icónica que hace que cualquier combinación básica se vea intencional, costosa y llena de moda.`,
  () => `La inversión perfecta para tu clóset: una pieza que nunca pasa de moda y te rescata en cualquier temporada.`,
  () => `Siente la satisfacción de lucir una chaqueta/chaleco que define tu figura y te aporta ese toque cosmopolita y moderno.`,
  () => `Ideal para acompañar tus días de oficina, salidas casuales o eventos nocturnos con el equilibrio perfecto entre estilo y practicidad.`,
  () => `Una prenda que te hace sentir empoderada, elegante y lista para conquistar cualquier escenario.`,
  () => `El secreto de las mejores estilistas para crear looks con volumen, textura y personalidad arrolladora.`,
  () => `Diseñada para quienes entienden que una buena prenda exterior es la carta de presentación de cualquier atuendo.`,
];

const accionTerceras = [
  (r: string) => `¡Completa tu colección con la REF ${r}! Solicítala antes de agotar existencia en bodega.`,
  (r: string) => `Hazla tuya hoy y dale versatilidad a tus outfits con la REF ${r}.`,
  (r: string) => `Pídela ahora en tu talla preferida. La REF ${r} es un clásico que no puedes dejar ir.`,
  (r: string) => `Asegura la REF ${r} para tus clientes hoy mismo y garantiza una prenda de alta rotación.`,
  (r: string) => `No te quedes sin la REF ${r}. Consulta disponibilidad en catálogo ahora.`,
  (r: string) => `¡Es momento de estrenar una prenda inolvidable! Separa la REF ${r} ya.`,
  (r: string) => `Dale a tu guardarropa el upgrade que necesita. Solicita la REF ${r} hoy.`,
  (r: string) => `Confirma tu pedido de la REF ${r} con un clic y disfruta de su confección superior.`,
];

// VESTIDOS, ENTERIZOS, FALDAS Y BERMUDAS
const atencionVestidos = [
  (n: string, r: string, d: string) => `Feminidad y movimiento en cada paso: descubre el ${n} (REF ${r})${d ? `, diseñado con ${d}` : ""}. Un look completo en un solo gesto.`,
  (n: string, r: string, d: string) => `Roba miradas con la frescura y encanto del ${n} (REF ${r})${d ? ` con ${d}` : ""}. Belleza sin complicaciones.`,
  (n: string, r: string, d: string) => `La prenda estelar para tus ocasiones especiales: ${n} (REF ${r})${d ? ` destacando por su ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Celebra tu estilo con el ${n} (REF ${r})${d ? `, confeccionado con ${d}` : ""}, pensado para estilizar y cautivar.`,
  (n: string, r: string, d: string) => `Comodidad fluida y presencia imponente: conoce el ${n} (REF ${r})${d ? ` con ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Una pieza que despierta suspiros: ${n} (REF ${r})${d ? ` y sus delicados ${d}` : ""}.`,
  (n: string, r: string, d: string) => `Siente la magia de lucir radiante con el ${n} (REF ${r})${d ? ` que incorpora ${d}` : ""}.`,
  (n: string, r: string, d: string) => `El equilibrio perfecto entre comodidad veraniega y elegancia chic: ${n} (REF ${r})${d ? ` con ${d}` : ""}.`,
];

const interesVestidos = [
  (c: string) => `Confeccionado en ${c}, su tejido ligero y fluido aporta una caída sensacional que acompaña cada movimiento con gracia.`,
  (c: string) => `Su composición en ${c} ofrece frescura y adaptabilidad, permitiendo que la prenda respire y se ajuste con naturalidad al cuerpo.`,
  (c: string) => `Elaborado con ${c}, su textura suave al tacto y acabado de alta costura garantizan durabilidad y confort inigualables.`,
  (c: string) => `Fabricado en ${c}, su estructura anatómica estiliza la cintura y resalta el busto con sutileza y buen gusto.`,
  (c: string) => `Su tejido en ${c} no transparenta ni pierde su caída original, manteniéndose impecable durante todo el evento.`,
  (c: string) => `Hecho con ${c}, combina suavidad extrema con una silueta envolvente pensada para adaptarse a diversas tipologías de cuerpo.`,
  (c: string) => `Confección premium en ${c} que realza el colorido y ofrece un secado rápido y fácil mantenimiento.`,
  (c: string) => `Gracias a su formulación en ${c}, disfrutarás de una prenda ligera que no se arruga fácilmente y te mantiene fresca.`,
];

const deseoVestidos = [
  () => `Imagínate caminando con la seguridad de que tu silueta se ve estilizada, femenina y llena de gracia.`,
  () => `La prenda perfecta para solucionar tu outfit en segundos: solo añade tus accesorios y calzado favorito para deslumbrar.`,
  () => `Ideal para paseos de fin de semana, celebraciones diurnas o veladas románticas; siempre serás el centro de atención.`,
  () => `Siente la libertad de vestir una pieza fresca y favorecedora que te hace sentir atractiva y cómoda al mismo tiempo.`,
  () => `Esa prenda especial que te pones cuando quieres verte sensacional sin pasar horas decidiendo qué ponerte.`,
  () => `Diseñado para realzar tu belleza innata con un aire romántico, moderno y sofisticado.`,
  () => `Una pieza que te transporta a tus momentos más memorables con el estilo inconfundible de Trucco's.`,
  () => `La combinación ideal de sensualidad y elegancia para mujeres que disfrutan vestirse bien todos los días.`,
];

const accionVestidos = [
  (r: string) => `¡Hazlo tuyo antes de que se agote! Solicita la REF ${r} en tus tallas y colores preferidos hoy mismo.`,
  (r: string) => `Asegura tu REF ${r} en catálogo ahora y deslumbra con un outfit listo para triunfar.`,
  (r: string) => `No te quedes sin la REF ${r}. Pídela ya y recíbela con despacho prioritario.`,
  (r: string) => `¡El momento de lucir radiante es hoy! Separa la REF ${r} en tu pedido.`,
  (r: string) => `Consulta disponibilidad de la REF ${r} y asegura tu prenda antes del próximo evento.`,
  (r: string) => `Pide la REF ${r} ahora y dale a tu estilo el toque femenino que estabas buscando.`,
  (r: string) => `¡Agrégalo a tu carrito de pedidos! La REF ${r} es una de las favoritas de la temporada.`,
  (r: string) => `Confirma tu solicitud de la REF ${r} con un solo clic y garantiza tu talla favorita.`,
];

// ==========================================
// PARSER DE DESCRIPCIONES DESDE SHOPIFY HTML
// ==========================================

export function parseAidaFromShopifyHtml(
  html: string,
  fallbackName: string,
  fallbackRef: string
): AIDAStructure | null {
  if (!html || !html.trim()) return null;

  const cleanHtml = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Extract all <p> tags contents
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const rawParagraphs: string[] = [];
  let match;
  while ((match = pRegex.exec(cleanHtml)) !== null) {
    const pText = match[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    if (pText.length > 0) {
      rawParagraphs.push(pText);
    }
  }

  if (rawParagraphs.length === 0) return null;

  // Separate metadata lines (REF, Elaborado en, Composición) from body paragraphs
  let refFound = fallbackRef;
  let compFound = "";
  const contentParagraphs: string[] = [];

  for (const p of rawParagraphs) {
    const upper = p.toUpperCase();
    if (upper.startsWith("REF:") || upper.startsWith("REFERENCIA:")) {
      refFound = p.replace(/^REF(ERENCIA)?:\s*/i, "").trim().replace(/\.$/, "");
    } else if (upper.startsWith("ELABORADO EN:") || upper.startsWith("COMPOSICION:") || upper.startsWith("COMPOSICIÓN:")) {
      compFound = p.replace(/^(ELABORADO EN|COMPOSICI[OÓ]N):\s*/i, "").trim();
    } else {
      contentParagraphs.push(p);
    }
  }

  if (contentParagraphs.length === 0) return null;

  let atencion = "";
  let interes = "";
  let deseo = "";
  let accion = "";

  if (contentParagraphs.length >= 4) {
    atencion = contentParagraphs[0];
    interes = contentParagraphs[1];
    deseo = contentParagraphs[2];
    accion = contentParagraphs[3];
  } else if (contentParagraphs.length === 3) {
    atencion = contentParagraphs[0];
    interes = contentParagraphs[1];
    const rest = contentParagraphs[2];
    const sentences = rest.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 2) {
      deseo = sentences.slice(0, Math.ceil(sentences.length / 2)).join(" ");
      accion = sentences.slice(Math.ceil(sentences.length / 2)).join(" ");
    } else {
      deseo = rest;
      accion = "Disponible en catálogo. Solicita tu pedido en tus tallas y colores preferidos hoy mismo.";
    }
  } else if (contentParagraphs.length === 2) {
    atencion = contentParagraphs[0];
    const rest = contentParagraphs[1];
    const sentences = rest.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 3) {
      interes = sentences[0];
      deseo = sentences.slice(1, sentences.length - 1).join(" ");
      accion = sentences[sentences.length - 1];
    } else {
      interes = rest;
      deseo = "Diseñado para hacerte sentir cómoda, estilizada y a la moda en cualquier ocasión.";
      accion = "Haz tuyo este modelo y completa tu guardarropa hoy mismo.";
    }
  } else {
    // 1 single combined paragraph containing all sentences
    const text = contentParagraphs[0];
    const sentences = text.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 4) {
      const q = Math.max(1, Math.floor(sentences.length / 4));
      atencion = sentences.slice(0, q).join(" ");
      interes = sentences.slice(q, q * 2).join(" ");
      deseo = sentences.slice(q * 2, sentences.length - 1).join(" ");
      accion = sentences.slice(sentences.length - 1).join(" ");
    } else {
      atencion = sentences[0] || text;
      interes = sentences[1] || "Confeccionada con materiales de primera calidad para garantizar ajuste y durabilidad.";
      deseo = sentences[2] || "Ideal para complementar tus mejores outfits con confort ininterrumpido y estilo.";
      accion = sentences[3] || "¡Hazla parte de tu guardarropa hoy mismo antes de que se agote!";
    }
  }

  const micro = parseProductMicroDetails(fallbackName);
  const tallaMod = getModelSize(refFound);
  const mood = "Colección Tendencias Trucco's Denim";

  let defaultComp = "Denim Confort Strech (98% Algodón, 2% Elastano)";
  if (micro.category === "Blusa" || micro.category === "Top" || micro.category === "Camisa") {
    defaultComp = "Chalis Suave & Algodón Transpirable";
  } else if (micro.category === "Vestido" || micro.category === "Enterizo") {
    defaultComp = "Tejido Fluido de Gran Caída";
  } else if (micro.category === "Chaqueta" || micro.category === "Chaleco") {
    defaultComp = "Denim Pesado 100% Algodón Rígido";
  }

  const finalComp = compFound || defaultComp;

  const fullHTML = `<div class="aida-description">
  <p class="aida-atencion"><strong>${atencion}</strong></p>
  <p class="aida-interes">${interes}</p>
  <p class="aida-deseo">${deseo}</p>
  <p class="aida-accion"><strong>${accion}</strong></p>
  <hr />
  <p><strong>REFERENCIA:</strong> ${refFound}</p>
  <p><strong>COMPOSICIÓN:</strong> ${finalComp}</p>
  <p><strong>COLECCIÓN:</strong> ${mood}</p>
  <p><strong>TALLA DE MODELO:</strong> Talla ${tallaMod}</p>
</div>`;

  const fullText = `🌟 *${fallbackName.toUpperCase()}* (REF ${refFound})\n\n` +
    `🎯 *Atención:* ${atencion}\n\n` +
    `💡 *Interés:* ${interes}\n\n` +
    `✨ *Deseo:* ${deseo}\n\n` +
    `🛍️ *Acción:* ${accion}\n\n` +
    `📋 *Detalles Comerciales:*\n` +
    `• *Referencia:* ${refFound}\n` +
    `• *Composición:* ${finalComp}\n` +
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
    composicion: finalComp,
    tallaModelo: tallaMod,
    isFromShopify: true,
  };
}

// ==========================================
// GENERADOR DE AIDA DETERMINÍSTICO Y ÚNICO
// ==========================================

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

  // Hash determinístico basado en referencia y nombre
  const h = hashString(ref + (rawNombre || nombreClean));

  // Determine default composition based on category
  let defaultComp = "100% Algodón Premium";
  if (micro.category === "Jean" || micro.category === "Pantalón") {
    defaultComp = pick(
      [
        "Denim Confort Strech (98% Algodón, 2% Elastano)",
        "Denim Suave Alto Ajuste (97% Algodón, 3% Spandex)",
        "Mezcla Algodón y Lycra de Alta Recuperación",
        "Denim Rígido Clásico 100% Algodón",
      ],
      h,
      1
    );
  } else if (micro.category === "Blusa" || micro.category === "Top" || micro.category === "Camisa") {
    defaultComp = pick(
      [
        "Chalis Suave & Algodón Transpirable",
        "Popelina Suave 100% Algodón",
        "Tejido Viscosa de Gran Caída",
        "Rib Algodón Confort",
      ],
      h,
      1
    );
  } else if (micro.category === "Chaqueta" || micro.category === "Chaleco") {
    defaultComp = pick(
      [
        "Denim Pesado 100% Algodón Rígido",
        "Denim Strech Confort con Lavado Artesanal",
        "Drill de Alta Resistencia",
      ],
      h,
      1
    );
  } else if (micro.category === "Vestido" || micro.category === "Enterizo") {
    defaultComp = pick(
      [
        "Tejido Fluido de Gran Caída y Movimiento",
        "Chalis Estampado 100% Rayón",
        "Lino & Algodón Fresco",
      ],
      h,
      1
    );
  } else if (micro.category === "Short/Bermuda") {
    defaultComp = pick(
      [
        "Denim Confort Strech (98% Algodón, 2% Elastano)",
        "Drill Satinado Confortable",
        "Mezcla Algodón y Lino Fresco",
      ],
      h,
      1
    );
  }

  const compClean = (composicion || "").trim() || defaultComp;

  // Build specific feature phrase
  const featureParts: string[] = [];
  if (micro.silhouette) featureParts.push(micro.silhouette);
  if (micro.neckline) featureParts.push(`con ${micro.neckline}`);
  if (micro.sleeves) featureParts.push(micro.sleeves);
  if (micro.accents.length) featureParts.push(`y ${micro.accents.join(", ")}`);

  const specificFeatureDesc = featureParts.length ? featureParts.join(" ") : "";

  let atencion: string;
  let interes: string;
  let deseo: string;
  let accion: string;

  if (ref.startsWith("P")) {
    // Plus Size Line
    atencion = pick(atencionPlus, h, 0)(nombreClean, ref, specificFeatureDesc);
    interes = pick(interesPlus, h, 1)(compClean);
    deseo = pick(deseoPlus, h, 2)();
    accion = pick(accionPlus, h, 3)(ref);
  } else if (micro.category === "Jean" || micro.category === "Pantalón") {
    atencion = pick(atencionJeans, h, 0)(nombreClean, ref, specificFeatureDesc);
    interes = pick(interesJeans, h, 1)(compClean);
    deseo = pick(deseoJeans, h, 2)();
    accion = pick(accionJeans, h, 3)(ref);
  } else if (micro.category === "Blusa" || micro.category === "Top" || micro.category === "Camisa") {
    atencion = pick(atencionBlusas, h, 0)(nombreClean, ref, specificFeatureDesc);
    interes = pick(interesBlusas, h, 1)(compClean);
    deseo = pick(deseoBlusas, h, 2)();
    accion = pick(accionBlusas, h, 3)(ref);
  } else if (micro.category === "Chaqueta" || micro.category === "Chaleco" || micro.category === "Buzo" || micro.category === "Blazer") {
    atencion = pick(atencionTerceras, h, 0)(nombreClean, ref, specificFeatureDesc);
    interes = pick(interesTerceras, h, 1)(compClean);
    deseo = pick(deseoTerceras, h, 2)();
    accion = pick(accionTerceras, h, 3)(ref);
  } else {
    atencion = pick(atencionVestidos, h, 0)(nombreClean, ref, specificFeatureDesc);
    interes = pick(interesVestidos, h, 1)(compClean);
    deseo = pick(deseoVestidos, h, 2)();
    accion = pick(accionVestidos, h, 3)(ref);
  }

  const mood = "Colección Tendencias Trucco's Denim";

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
    composicion: compClean,
    tallaModelo: tallaMod,
    isFromShopify: false,
  };
}
