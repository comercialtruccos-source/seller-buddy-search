import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileWarning,
  Link2,
  Download,
  DollarSign,
  Bot,
  Mic,
  Warehouse,
  Building2,
  Check,
  X,
  Trash2,
  Filter,
  Layers,
  ScanBarcode,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Switch } from "@/components/ui/switch";

import {
  parseInventoryCsv,
  readCsvFileText,
  saveInventory,
  updateAllPricesWithTrm,
  fetchBodegasFromDb,
  deleteBodegasFromDb,
} from "@/lib/inventory";
import { downloadCsvFromUrl } from "@/lib/shopify";

export const Route = createFileRoute("/cargar")({
  component: Cargar,
});

const DEFAULT_BODEGAS = [
  "PRINCIPAL 1004",
  "SEGUNDAS BODEGA 1005",
  "BODEGA ARREGLOS",
  "BODEGA COBROS",
  "BODEGA MUESTRAS VENDEDORES",
  "MUESTRAS MERCADEO",
  "TIENDA MAYORCA",
];

function Cargar() {
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncUrl, setSyncUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sync_csv_url") || "";
    }
    return "";
  });
  const [uploadedInfo, setUploadedInfo] = useState<{
    count: number;
    filename: string;
    skippedCount?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const [trmValue, setTrmValue] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("trm_value") || "4000";
    }
    return "4000";
  });

  const readVoiceFlag = (key: string) => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem(key);
    if (saved !== null) return saved === "true";
    const legacy = localStorage.getItem("voice_assistant_enabled");
    return legacy !== null ? legacy === "true" : true;
  };

  const [voiceSearchEnabled, setVoiceSearchEnabled] = useState<boolean>(true);
  const [voiceOrderEnabled, setVoiceOrderEnabled] = useState<boolean>(true);
  const [barcodeScannerEnabled, setBarcodeScannerEnabled] = useState<boolean>(true);

  // Bodegas state management
  const [disabledBodegas, setDisabledBodegas] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("disabled_bodegas");
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          console.error("Error parsing disabled_bodegas", e);
        }
      }
    }
    return new Set();
  });

  const [knownBodegas, setKnownBodegas] = useState<string[]>(DEFAULT_BODEGAS);
  const [isPurgingBodegas, setIsPurgingBodegas] = useState(false);

  useEffect(() => {
    setVoiceSearchEnabled(readVoiceFlag("voice_search_enabled"));
    setVoiceOrderEnabled(readVoiceFlag("voice_order_assistant_enabled"));
    setBarcodeScannerEnabled(readVoiceFlag("barcode_scanner_enabled"));

    // Fetch existing bodegas from Supabase on mount
    fetchBodegasFromDb()
      .then((dbBodegas) => {
        if (dbBodegas && dbBodegas.length > 0) {
          setKnownBodegas((prev) => {
            const merged = new Set([...prev, ...dbBodegas]);
            return Array.from(merged).sort((a, b) => a.localeCompare(b, "es"));
          });
        }
      })
      .catch((err) => {
        console.error("Error fetching bodegas from DB:", err);
      });
  }, []);

  const persistVoiceFlag = (key: string, checked: boolean, label: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, String(checked));
      window.dispatchEvent(new Event("storage"));
    }
    toast.success(`${label} ${checked ? "activado" : "desactivado"} correctamente.`);
  };

  const handleToggleVoiceSearch = (checked: boolean) => {
    setVoiceSearchEnabled(checked);
    persistVoiceFlag("voice_search_enabled", checked, "Buscador por voz");
  };

  const handleToggleVoiceOrder = (checked: boolean) => {
    setVoiceOrderEnabled(checked);
    persistVoiceFlag("voice_order_assistant_enabled", checked, "Asistente de Pedidos por Voz");
  };

  const handleToggleBarcodeScanner = (checked: boolean) => {
    setBarcodeScannerEnabled(checked);
    persistVoiceFlag("barcode_scanner_enabled", checked, "Escáner de Códigos");
  };

  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  const handleTrmChange = (val: string) => {
    setTrmValue(val);
    localStorage.setItem("trm_value", val);
  };

  const handleToggleBodega = (bodegaName: string, enabled: boolean) => {
    setDisabledBodegas((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.delete(bodegaName);
      } else {
        next.add(bodegaName);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("disabled_bodegas", JSON.stringify(Array.from(next)));
      }
      return next;
    });
    toast.success(`Bodega "${bodegaName}" ${enabled ? "ACTIVADA" : "DESACTIVADA"}.`);
  };

  const handleEnableAllBodegas = () => {
    setDisabledBodegas(new Set());
    if (typeof window !== "undefined") {
      localStorage.removeItem("disabled_bodegas");
    }
    toast.success("Todas las bodegas han sido activadas.");
  };

  const handleDisableAllExceptPrincipal = () => {
    const next = new Set(knownBodegas.filter((b) => b !== "PRINCIPAL 1004"));
    setDisabledBodegas(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("disabled_bodegas", JSON.stringify(Array.from(next)));
    }
    toast.success("Se activó únicamente la bodega PRINCIPAL 1004.");
  };

  const handlePurgeDisabledBodegasInDb = async () => {
    const toDelete = Array.from(disabledBodegas);
    if (toDelete.length === 0) {
      toast.info("No hay bodegas desactivadas seleccionadas.");
      return;
    }

    if (
      !confirm(
        `¿Estás seguro de eliminar permanentemente de Supabase todos los registros de las siguientes ${toDelete.length} bodegas desactivadas?\n\n` +
          toDelete.map((b) => `• ${b}`).join("\n")
      )
    ) {
      return;
    }

    try {
      setIsPurgingBodegas(true);
      toast.loading("Eliminando registros de bodegas desactivadas en Supabase…", {
        id: "purge-bodegas",
      });
      const count = await deleteBodegasFromDb(toDelete);
      toast.success(
        `¡Éxito! Se eliminaron ${count} registros de bodegas desactivadas en la base de datos.`,
        { id: "purge-bodegas" }
      );
    } catch (error: any) {
      console.error(error);
      const errMsg = error.message || error.details || "error desconocido";
      toast.error(`Error al eliminar registros: ${errMsg}`, { id: "purge-bodegas" });
    } finally {
      setIsPurgingBodegas(false);
    }
  };

  const processAndSaveRows = async (parsed: ReturnType<typeof parseInventoryCsv>, sourceName: string) => {
    // 1. Auto-discover any new bodegas present in the parsed rows
    const fileBodegas = Array.from(new Set(parsed.map((r) => (r.bodega || "PRINCIPAL 1004").trim())));
    if (fileBodegas.length > 0) {
      setKnownBodegas((prev) => {
        const merged = new Set([...prev, ...fileBodegas]);
        return Array.from(merged).sort((a, b) => a.localeCompare(b, "es"));
      });
    }

    // 2. Filter rows according to active/disabled bodegas selection
    const activeRows = parsed.filter((r) => {
      const bName = (r.bodega || "PRINCIPAL 1004").trim();
      return !disabledBodegas.has(bName);
    });

    if (activeRows.length === 0) {
      toast.error(
        "Todas las bodegas presentes en el archivo están desactivadas en tu configuración. Activa al menos una bodega en el panel de 'Bodegas Activas' para continuar."
      );
      return false;
    }

    const skippedCount = parsed.length - activeRows.length;

    toast.loading("Guardando inventario en Supabase…", { id: "save-inventory" });
    await saveInventory(activeRows);

    setUploadedInfo({
      count: activeRows.length,
      filename: sourceName,
      skippedCount,
    });

    let successMsg = `¡Éxito! Se cargaron e integraron ${activeRows.length} registros de bodegas activas.`;
    if (skippedCount > 0) {
      successMsg += ` (Se omitieron ${skippedCount} registros de bodegas desactivadas).`;
    }

    toast.success(successMsg, { id: "save-inventory", duration: 5000 });
    return true;
  };

  const handleUpdateAllPrices = async () => {
    const trmNum = parseFloat(trmValue);
    if (!trmValue || isNaN(trmNum) || trmNum <= 0) {
      toast.error("Por favor ingresa un valor de TRM válido y mayor a 0.");
      return;
    }

    try {
      setIsUpdatingPrices(true);
      toast.loading("Actualizando todos los precios en la base de datos…", { id: "update-prices" });
      const count = await updateAllPricesWithTrm(trmNum);
      toast.success(
        `¡Éxito! Se actualizaron los precios en dólares de ${count} registros con la TRM de $${trmNum.toLocaleString("es-CO")} COP.`,
        { id: "update-prices" }
      );
    } catch (error: any) {
      console.error(error);
      const errMsg = error.message || error.details || error.hint || "error desconocido";
      toast.error(`Error al actualizar los precios: ${errMsg}`, { id: "update-prices" });
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const downloadTemplateCsv = () => {
    const headers = [
      "Referencia",
      "Descripción",
      "Talla - Lote",
      "Color",
      "Saldo",
      "Talla",
      "CodColor",
      "SKU",
      "PVM UNIT",
      "PVP UNIT",
      "Precio USD",
      "Imagen",
      "Bodega",
    ];

    const sampleRows = [
      [
        "REF001",
        "Pantalón Jean Vaquero",
        "02-01",
        "AZUL",
        "10",
        "02",
        "01",
        "SKU-REF001-AZ-02",
        "45000",
        "85000",
        "12.50",
        "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=1000",
        "PRINCIPAL 1004",
      ],
      [
        "REF001",
        "Pantalón Jean Vaquero",
        "04-01",
        "AZUL",
        "5",
        "04",
        "01",
        "SKU-REF001-AZ-04",
        "45000",
        "85000",
        "12.50",
        "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=1000",
        "PRINCIPAL 1004",
      ],
    ];

    const csvContent = [
      headers.join(","),
      ...sampleRows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_inventario.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Plantilla CSV descargada correctamente.");
  };

  const handleSyncFromUrl = async () => {
    const trimmedUrl = syncUrl.trim();
    if (!trimmedUrl) {
      toast.error("Por favor ingresa una URL válida.");
      return;
    }

    const trmNum = parseFloat(trmValue);
    if (!trmValue || isNaN(trmNum) || trmNum <= 0) {
      toast.error("Por favor ingresa un valor de TRM válido y mayor a 0 antes de sincronizar.");
      return;
    }

    try {
      setIsSyncing(true);
      setUploadedInfo(null);

      localStorage.setItem("sync_csv_url", trimmedUrl);
      toast.loading("Descargando inventario desde la URL…", { id: "save-inventory" });

      const text = await downloadCsvFromUrl({ data: trimmedUrl });
      const parsed = parseInventoryCsv(text, trmNum);

      if (parsed.length === 0) {
        toast.error("No se encontraron registros válidos. Verifica que la URL sea un CSV correcto.", {
          id: "save-inventory",
        });
        return;
      }

      await processAndSaveRows(parsed, "Enlace en la nube");
    } catch (error: any) {
      console.error(error);
      toast.error(`Error al sincronizar: ${error.message || "error desconocido"}`, {
        id: "save-inventory",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePasteText = async () => {
    const text = pasteRef.current?.value?.trim() || "";
    if (!text) {
      toast.error("Por favor pega el texto del inventario antes de continuar.");
      return;
    }

    if (text.toLowerCase().includes("recuperando datos") || text.toLowerCase().includes("retrieving data")) {
      toast.error(
        "Excel Online aún está preparando los datos. Por favor espera unos segundos en Excel, vuelve a copiar (Ctrl+C) y pega de nuevo.",
        { duration: 5000 }
      );
      return;
    }

    const trmNum = parseFloat(trmValue);
    if (!trmValue || isNaN(trmNum) || trmNum <= 0) {
      toast.error("Por favor ingresa un valor de TRM válido y mayor a 0 antes de cargar.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadedInfo(null);

      const parsed = parseInventoryCsv(text, trmNum);

      if (parsed.length === 0) {
        toast.error("No se encontraron registros válidos o el formato es incorrecto.");
        setIsUploading(false);
        return;
      }

      const success = await processAndSaveRows(parsed, "Texto pegado desde el portapapeles");
      if (success && pasteRef.current) {
        pasteRef.current.value = "";
      }
    } catch (error: any) {
      console.error(error);
      const errMsg = error.message || error.details || error.hint || "error desconocido";
      toast.error(`Error al procesar el texto: ${errMsg}`, {
        id: "save-inventory",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, sube solo archivos en formato CSV.");
      return;
    }

    const trmNum = parseFloat(trmValue);
    if (!trmValue || isNaN(trmNum) || trmNum <= 0) {
      toast.error("Por favor ingresa un valor de TRM válido y mayor a 0 antes de cargar.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadedInfo(null);

      const text = await readCsvFileText(file);
      const parsed = parseInventoryCsv(text, trmNum);

      if (parsed.length === 0) {
        toast.error("El archivo no contiene referencias válidas o el formato es incorrecto.");
        setIsUploading(false);
        return;
      }

      await processAndSaveRows(parsed, file.name);
    } catch (error: any) {
      console.error(error);
      const errMsg = error.message || error.details || error.hint || "error desconocido";
      toast.error(`Ocurrió un error al guardar: ${errMsg}`, {
        id: "save-inventory",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const activeBodegasCount = knownBodegas.filter((b) => !disabledBodegas.has(b)).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-6">
          <Link
            to="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-primary-foreground hover:bg-accent/30 transition-colors"
            title="Volver al buscador"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold leading-tight">Cargar Inventario</h1>
            <p className="text-sm text-primary-foreground/70">
              Actualiza las referencias en Supabase y gestiona las bodegas activas
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-10 flex-1 w-full flex flex-col justify-center">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-accent" />
              Importar archivo de inventario
            </h2>
            <p className="text-sm text-muted-foreground">
              Sube un archivo CSV o pega el contenido desde Excel. El sistema detectará las bodegas automáticamente y <strong>sólo reemplazará</strong> las bodegas activadas en tu configuración.
            </p>
          </div>

          {/* MÓDULO: Control de Bodegas Activas */}
          <div className="bg-muted/40 border border-border rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-accent" />
                  Control de Bodegas Activas ({activeBodegasCount} de {knownBodegas.length} activas)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Activa o desactiva las bodegas que deseas procesar. Al cargar un archivo, <strong>las bodegas desactivadas serán ignoradas automáticamente</strong> sin necesidad de editar tu Excel.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleEnableAllBodegas}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 transition-all cursor-pointer"
                >
                  Activar todas
                </button>
                <button
                  type="button"
                  onClick={handleDisableAllExceptPrincipal}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-background text-muted-foreground hover:text-foreground border border-border transition-all cursor-pointer"
                >
                  Solo Principal
                </button>
              </div>
            </div>

            {/* Grid de Bodegas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {knownBodegas.map((bodegaName) => {
                const isActive = !disabledBodegas.has(bodegaName);
                return (
                  <div
                    key={bodegaName}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isActive
                        ? "bg-background border-accent/40 shadow-2xs"
                        : "bg-muted/60 border-border/60 opacity-65"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <Building2
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? "text-accent" : "text-muted-foreground"
                        }`}
                      />
                      <span className={`text-xs font-semibold truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {bodegaName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {isActive ? "Activa" : "Inactiva"}
                      </span>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) => handleToggleBodega(bodegaName, checked)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Opción de Limpieza en Supabase */}
            {disabledBodegas.size > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  Tienes {disabledBodegas.size} bodega(s) desactivada(s). ¿Deseas borrar su inventario actual de la base de datos?
                </span>
                <button
                  type="button"
                  onClick={handlePurgeDisabledBodegasInDb}
                  disabled={isPurgingBodegas}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 font-semibold text-[11px] transition-all cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isPurgingBodegas ? "Limpiando..." : "Eliminar de la BD"}
                </button>
              </div>
            )}
          </div>

          {/* Configuración de TRM */}
          <div className="bg-muted/40 border border-border rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-accent" />
              Configuración de TRM (Manual)
            </h3>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Configura el valor de la TRM para calcular automáticamente el precio en dólares de cada artículo.
              <br />
              <strong className="text-accent font-semibold">Fórmula:</strong>{" "}
              <code className="bg-background/80 px-1 py-0.5 rounded text-foreground border border-border/50 text-[11px]">
                ((Precio Mayorista / 1.19) + $1.000) / TRM
              </code>
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="relative w-36">
                  <span className="absolute left-3 top-2 text-sm text-muted-foreground font-medium">$</span>
                  <input
                    type="number"
                    value={trmValue}
                    onChange={(e) => handleTrmChange(e.target.value)}
                    placeholder="Ej. 4000"
                    min="1"
                    step="any"
                    disabled={isUpdatingPrices || isUploading || isSyncing}
                    className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-1.5 text-sm text-foreground focus:border-accent focus:ring-1 focus:ring-accent outline-hidden disabled:opacity-50"
                  />
                </div>
                <span className="text-xs text-muted-foreground">COP por Dólar</span>
              </div>

              <button
                onClick={handleUpdateAllPrices}
                disabled={isUpdatingPrices || isUploading || isSyncing || !trmValue}
                className="sm:ml-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground hover:bg-accent/90 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 select-none cursor-pointer"
              >
                {isUpdatingPrices ? "Actualizando precios..." : "Actualizar precios de la Plataforma"}
              </button>
            </div>
          </div>

          {/* Configuración de Asistentes y Escáner */}
          <div className="bg-muted/40 border border-border rounded-xl p-4 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-accent" />
              Módulos de Voz y Escáner
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Mic className="h-4 w-4 text-accent shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">Buscador por voz</span>
                </div>
                <Switch checked={voiceSearchEnabled} onCheckedChange={handleToggleVoiceSearch} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <Bot className="h-4 w-4 text-accent shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">Asistente Pedidos</span>
                </div>
                <Switch checked={voiceOrderEnabled} onCheckedChange={handleToggleVoiceOrder} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <ScanBarcode className="h-4 w-4 text-accent shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate">Escáner Códigos</span>
                </div>
                <Switch checked={barcodeScannerEnabled} onCheckedChange={handleToggleBarcodeScanner} />
              </div>
            </div>
          </div>

          <div className="flex">
            <button
              onClick={downloadTemplateCsv}
              className="inline-flex items-center gap-2 text-xs font-bold text-accent hover:text-accent/80 transition-all border border-accent/20 bg-accent/5 px-3 py-1.5 rounded-lg hover:scale-[1.02] active:scale-95 shadow-xs"
              title="Descargar archivo CSV de ejemplo con las columnas requeridas"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar plantilla/formato CSV
            </button>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isUploading && !isUpdatingPrices && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
              dragActive
                ? "border-accent bg-accent/10 scale-[1.02]"
                : "border-border hover:border-accent hover:bg-muted/50"
            } ${isUploading || isUpdatingPrices ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onInputChange}
              disabled={isUploading || isUpdatingPrices}
            />

            <div
              className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors ${
                dragActive ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <Upload className={`h-8 w-8 ${isUploading || isUpdatingPrices ? "animate-bounce" : ""}`} />
            </div>

            {isUploading ? (
              <div>
                <p className="font-semibold text-foreground">Procesando archivo...</p>
                <p className="text-xs text-muted-foreground mt-1">Por favor espera un momento</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-foreground">
                  Arrastra tu archivo CSV aquí, o <span className="text-accent underline">búscalo</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Solo se permiten archivos en formato .csv
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 flex items-center justify-between">
            <span className="h-px bg-border flex-1" />
            <span className="text-[10px] font-extrabold text-muted-foreground/60 px-3 uppercase tracking-wider">
              O pegar texto
            </span>
            <span className="h-px bg-border flex-1" />
          </div>

          {/* Paste Block */}
          <div className="bg-muted/30 border border-border/80 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-accent" />
              Pegar desde Excel (Portapapeles)
            </h3>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Si tienes problemas con archivos, selecciona tus datos en Excel, cópialos y pégalos aquí.
            </p>
            <div className="flex flex-col gap-3">
              <textarea
                ref={pasteRef}
                placeholder="Pega aquí el contenido de tu inventario (incluyendo la fila de encabezados)..."
                className="w-full min-h-32 rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-y"
              />
              <button
                onClick={handlePasteText}
                disabled={isUploading || isUpdatingPrices || isSyncing}
                className="self-end inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 select-none cursor-pointer"
              >
                {isUploading ? "Procesando..." : "Cargar desde texto"}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 flex items-center justify-between">
            <span className="h-px bg-border flex-1" />
            <span className="text-[10px] font-extrabold text-muted-foreground/60 px-3 uppercase tracking-wider">
              O sincronizar URL
            </span>
            <span className="h-px bg-border flex-1" />
          </div>

          {/* URL Sync Block */}
          <div className="bg-muted/30 border border-border/80 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-accent" />
              Sincronizar desde URL pública (CSV)
            </h3>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Ingresa el enlace de tu Google Sheets publicado como CSV para sincronizar las cantidades sin descargar archivos.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={syncUrl}
                onChange={(e) => setSyncUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:border-accent focus:ring-1 focus:ring-accent outline-hidden"
              />
              <button
                onClick={handleSyncFromUrl}
                disabled={isSyncing || isUploading || isUpdatingPrices || !syncUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 select-none cursor-pointer"
              >
                {isSyncing ? "Sincronizando..." : "Sincronizar"}
              </button>
            </div>
            <div className="mt-3 text-[10px] text-muted-foreground/75 leading-relaxed bg-accent/5 rounded-lg p-2.5 border border-accent/10">
              <span className="font-bold text-accent">¿Cómo obtener este enlace?</span> En tu hoja de cálculo de Google Sheets, ve a{" "}
              <strong>Archivo &gt; Compartir &gt; Publicar en la Web</strong>. Elige todo el documento o una pestaña específica, selecciona el formato{" "}
              <strong>Valores separados por comas (.csv)</strong> y copia la URL generada.
            </div>
          </div>

          {/* Upload Status Card */}
          {uploadedInfo && (
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 p-4 text-emerald-800 dark:text-emerald-300 animate-fade-in">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm">Carga completada con éxito</h4>
                <p className="text-xs mt-1">
                  Se ha actualizado la base de datos con <strong>{uploadedInfo.count}</strong> registros cargados desde <strong>{uploadedInfo.filename}</strong>.
                  {uploadedInfo.skippedCount && uploadedInfo.skippedCount > 0 ? (
                    <span className="block mt-1 text-emerald-700/80 font-medium">
                      (Se omitieron {uploadedInfo.skippedCount} registros de bodegas desactivadas).
                    </span>
                  ) : null}
                </p>
                <div className="mt-3">
                  <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold underline hover:no-underline">
                    Ir al buscador a verificar
                    <ArrowLeft className="h-3 w-3 rotate-180" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Formats and guidelines */}
          <div className="border-t border-border pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Columnas requeridas del archivo CSV
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              El archivo CSV debe contener las siguientes columnas separadas por comas (incluyendo la cabecera):
            </p>
            <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
              {[
                "Referencia",
                "Descripción",
                "Talla - Lote",
                "Color",
                "Saldo",
                "Talla",
                "CodColor",
                "SKU",
                "PVM UNIT",
                "PVP UNIT",
                "Bodega (Opcional)",
                "Image (Opcional)",
              ].map((h) => (
                <span key={h} className="rounded bg-muted px-2 py-1 text-foreground border border-border">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
