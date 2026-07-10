import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileWarning,
  Link2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  parseInventoryCsv,
  saveInventory,
} from "@/lib/inventory";
import { downloadCsvFromUrl } from "@/lib/shopify";

export const Route = createFileRoute("/cargar")({
  component: Cargar,
});

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
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSyncFromUrl = async () => {
    const trimmedUrl = syncUrl.trim();
    if (!trimmedUrl) {
      toast.error("Por favor ingresa una URL válida.");
      return;
    }

    try {
      setIsSyncing(true);
      setUploadedInfo(null);
      
      // Save URL to localStorage so they don't have to re-paste
      localStorage.setItem("sync_csv_url", trimmedUrl);

      toast.loading("Descargando inventario desde la URL…", { id: "sync-inventory" });
      
      // Fetch via server-side function to bypass browser CORS block and provide clear errors
      const text = await downloadCsvFromUrl({ data: trimmedUrl });
      const parsed = parseInventoryCsv(text);
      
      if (parsed.length === 0) {
        toast.error("No se encontraron registros válidos. Verifica que la URL sea un CSV con el formato correcto.", { id: "sync-inventory" });
        return;
      }

      toast.loading("Guardando inventario en Supabase…", { id: "sync-inventory" });
      await saveInventory(parsed);
      
      setUploadedInfo({
        count: parsed.length,
        filename: "Enlace en la nube",
      });
      
      toast.success(
        `¡Éxito! Se cargaron e integraron ${parsed.length} registros desde la URL.`,
        { id: "sync-inventory" }
      );
    } catch (error: any) {
      console.error(error);
      toast.error(`Error al sincronizar: ${error.message || "error desconocido"}`, {
        id: "sync-inventory",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, sube solo archivos en formato CSV.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadedInfo(null);
      
      const text = await file.text();
      const parsed = parseInventoryCsv(text);
      
      if (parsed.length === 0) {
        toast.error("El archivo no contiene referencias válidas o el formato es incorrecto.");
        setIsUploading(false);
        return;
      }

      toast.loading("Procesando y guardando inventario en Supabase…", { id: "save-inventory" });
      await saveInventory(parsed);
      
      setUploadedInfo({
        count: parsed.length,
        filename: file.name,
      });
      
      toast.success(
        `¡Éxito! Se cargaron ${parsed.length} registros del archivo "${file.name}".`,
        { id: "save-inventory" }
      );
    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error al intentar guardar el inventario. Inténtalo de nuevo.", {
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
              Actualiza las referencias en Supabase
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-12 flex-1 w-full flex flex-col justify-center">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-accent" />
            Importar archivo de inventario
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Sube un archivo CSV con las referencias y cantidades actualizadas. Este proceso reemplazará el inventario actual de la base de datos de manera definitiva.
          </p>

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
              dragActive
                ? "border-accent bg-accent/10 scale-[1.02]"
                : "border-border hover:border-accent hover:bg-muted/50"
            } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onInputChange}
              disabled={isUploading}
            />

            <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors ${
              dragActive ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            }`}>
              <Upload className={`h-8 w-8 ${isUploading ? "animate-bounce" : ""}`} />
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
          <div className="my-6 flex items-center justify-between">
            <span className="h-px bg-border flex-1" />
            <span className="text-[10px] font-extrabold text-muted-foreground/60 px-3 uppercase tracking-wider">O también</span>
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
                disabled={isSyncing || isUploading || !syncUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 select-none cursor-pointer"
              >
                {isSyncing ? "Sincronizando..." : "Sincronizar"}
              </button>
            </div>
            <div className="mt-3 text-[10px] text-muted-foreground/75 leading-relaxed bg-accent/5 rounded-lg p-2.5 border border-accent/10">
              <span className="font-bold text-accent">¿Cómo obtener este enlace?</span> En tu hoja de cálculo de Google Sheets, ve a <strong>Archivo &gt; Compartir &gt; Publicar en la Web</strong>. Elige todo el documento o una pestaña específica, selecciona el formato <strong>Valores separados por comas (.csv)</strong> y copia la URL generada.
            </div>
          </div>

          {/* Upload Status Card */}
          {uploadedInfo && (
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 p-4 text-emerald-800 dark:text-emerald-300 animate-fade-in">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm">Carga completada con éxito</h4>
                <p className="text-xs mt-1">
                  Se ha actualizado la base de datos con <strong>{uploadedInfo.count}</strong> registros cargados desde el archivo <strong>{uploadedInfo.filename}</strong>.
                </p>
                <div className="mt-3">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold underline hover:no-underline"
                  >
                    Ir al buscador a verificar
                    <ArrowLeft className="h-3 w-3 rotate-180" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Formats and guidelines */}
          <div className="mt-8 border-t border-border pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Columnas requeridas del archivo CSV
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              El archivo CSV debe contener exactamente las siguientes columnas separadas por comas (incluyendo la cabecera):
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
