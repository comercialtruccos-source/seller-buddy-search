import React, { useEffect, useState, useRef } from "react";
import {
  X,
  Upload,
  Camera,
  Loader2,
  Sparkles,
  Check,
  Search,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { scanTagImage } from "@/lib/tagScanner";
import { extractBaseSku } from "@/lib/inventory";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  open,
  onClose,
  onScan,
}) => {
  const [activeTab, setActiveTab] = useState<"photo" | "camera">("photo");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedSku, setDetectedSku] = useState("");
  const [detectionMethod, setDetectionMethod] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const html5QrcodeRef = useRef<any>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      stopLiveCamera();
      setPreviewUrl(null);
      setDetectedSku("");
      setDetectionMethod(null);
      setIsProcessingFile(false);
    }
  }, [open]);

  // Clean up camera on unmount or tab switch
  useEffect(() => {
    if (activeTab === "camera" && open) {
      startLiveCamera();
    } else {
      stopLiveCamera();
    }
    return () => {
      stopLiveCamera();
    };
  }, [activeTab, open]);

  const startLiveCamera = async () => {
    try {
      setIsCameraActive(true);
      const { Html5Qrcode } = await import("html5-qrcode");
      const elementId = "custom-camera-stream";
      
      if (!document.getElementById(elementId)) return;

      if (html5QrcodeRef.current) {
        try {
          await html5QrcodeRef.current.stop();
        } catch (e) {}
      }

      const html5Qrcode = new Html5Qrcode(elementId);
      html5QrcodeRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Beep audio on success
          try {
            if (typeof window !== "undefined") {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sine";
                osc.frequency.value = 800;
                gain.gain.setValueAtTime(0, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.2);
              }
            }
          } catch (e) {}

          const sku = extractBaseSku(decodedText);
          toast.success(`Código detectado por cámara: ${sku}`);
          stopLiveCamera();
          onScan(sku);
          onClose();
        },
        (errorMessage) => {
          // Ignore live frame scan errors
        }
      );
    } catch (err) {
      console.error("Error starting live camera stream:", err);
      setIsCameraActive(false);
      toast.error("No se pudo iniciar la cámara en vivo. Usa la opción de Foto de Etiqueta.");
    }
  };

  const stopLiveCamera = () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          html5QrcodeRef.current.stop().then(() => {
            html5QrcodeRef.current?.clear();
            html5QrcodeRef.current = null;
          }).catch(() => {
            html5QrcodeRef.current = null;
          });
        } else {
          html5QrcodeRef.current.clear();
          html5QrcodeRef.current = null;
        }
      } catch (e) {
        html5QrcodeRef.current = null;
      }
    }
    setIsCameraActive(false);
  };

  const handleProcessImageFile = async (file: File) => {
    if (!file) return;

    // Show image preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setDetectedSku("");
    setDetectionMethod(null);
    setIsProcessingFile(true);
    setStatusMessage("Analizando foto con IA y OCR...");

    try {
      const result = await scanTagImage(file, (msg) => setStatusMessage(msg));
      if (result) {
        setDetectedSku(result.sku);
        const label =
          result.method === "ocr-text"
            ? "Texto impreso en etiqueta (OCR)"
            : "Código de barras";
        setDetectionMethod(label);
        toast.success(`¡SKU Detectado!: ${result.sku}`);
      } else {
        toast.info(
          "No detectamos el SKU automáticamente. Puedes escribir la referencia abajo para realizar la búsqueda."
        );
      }
    } catch (err) {
      console.error("Error scanning tag image:", err);
      toast.error("Error al analizar la imagen.");
    } finally {
      setIsProcessingFile(false);
      setStatusMessage("");
    }
  };

  const handleConfirmSearch = () => {
    if (!detectedSku.trim()) {
      toast.error("Por favor ingresa o confirma el SKU a buscar.");
      return;
    }
    const cleanSku = extractBaseSku(detectedSku.trim());
    onScan(cleanSku);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
            Lector de SKU y Etiquetas
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 bg-muted/60 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Custom Tab Selector */}
        <div className="flex border-b border-border bg-muted/20 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab("photo")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === "photo"
                ? "bg-background text-primary shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <ImageIcon className="h-4 w-4 text-primary" />
            <span>Foto / Escáner SKU</span>
          </button>
          <button
            onClick={() => setActiveTab("camera")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === "camera"
                ? "bg-background text-primary shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Camera className="h-4 w-4 text-primary" />
            <span>Cámara en Vivo</span>
          </button>
        </div>

        {/* Tab 1 Body: Foto de Etiqueta & SKU Parser */}
        {activeTab === "photo" && (
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            <p className="text-xs text-muted-foreground text-center">
              Toma una foto de la etiqueta o sube una imagen de la prenda para detectar automáticamente el SKU (Referencia).
            </p>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleProcessImageFile(e.target.files[0]);
                }
              }}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleProcessImageFile(e.target.files[0]);
                }
              }}
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessingFile}
                className="py-3 px-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium shadow-md transition-all flex flex-col items-center justify-center gap-1.5 text-xs text-center"
              >
                <Camera className="h-5 w-5" />
                <span>Tomar Foto con Cámara</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="py-3 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60 rounded-xl font-medium shadow-sm transition-all flex flex-col items-center justify-center gap-1.5 text-xs text-center"
              >
                <Upload className="h-5 w-5 text-primary" />
                <span>Subir de Galería</span>
              </button>
            </div>

            {/* Image Preview & Scanner Status */}
            <div className="w-full relative bg-muted/30 border border-dashed border-border/80 rounded-2xl min-h-[180px] max-h-[260px] flex items-center justify-center overflow-hidden">
              {isProcessingFile ? (
                <div className="flex flex-col items-center justify-center p-6 gap-3 text-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs font-semibold text-foreground">{statusMessage}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Analizando código de barras y texto impreso...
                  </p>
                </div>
              ) : previewUrl ? (
                <div className="relative w-full h-full flex items-center justify-center bg-black/40">
                  <img
                    src={previewUrl}
                    alt="Etiqueta"
                    className="max-h-[240px] w-auto object-contain rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setPreviewUrl(null);
                      setDetectedSku("");
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 gap-2 text-center cursor-pointer hover:bg-muted/50 transition-colors w-full h-full"
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Haz clic para seleccionar o tomar la foto de la etiqueta
                  </span>
                </div>
              )}
            </div>

            {/* SKU Results & Confirmation Box */}
            <div className="bg-muted/40 border border-border/70 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>SKU / Referencia a Buscar:</span>
                </label>
                {detectionMethod && (
                  <span className="text-[10px] bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
                    {detectionMethod}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={detectedSku}
                  onChange={(e) => setDetectedSku(e.target.value.toUpperCase())}
                  placeholder="Ej: T12032107"
                  className="flex-1 px-3 py-2 bg-background border border-input rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase tracking-wider"
                />
                <button
                  onClick={handleConfirmSearch}
                  disabled={!detectedSku.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Search className="h-4 w-4" />
                  <span>Buscar</span>
                </button>
              </div>

              {!detectedSku && !isProcessingFile && previewUrl && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Escribe la referencia arriba si no se detectó automáticamente.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2 Body: Live Camera Stream */}
        {activeTab === "camera" && (
          <div className="p-4 flex flex-col items-center gap-3">
            <p className="text-xs text-muted-foreground text-center">
              Apunta la cámara al código de barras de la prenda para lectura instantánea.
            </p>

            <div className="w-full relative bg-black/90 rounded-2xl overflow-hidden min-h-[280px] max-h-[320px] flex items-center justify-center shadow-inner border border-border">
              {/* Custom Frame Target Overlay */}
              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                <div className="w-[240px] h-[150px] border-2 border-primary/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-primary rounded-tl"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-primary rounded-tr"></div>
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-primary rounded-bl"></div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-primary rounded-br"></div>
                  <div className="w-full h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,1)] animate-pulse absolute top-1/2 -translate-y-1/2"></div>
                </div>
              </div>

              {/* Headless html5-qrcode element */}
              <div id="custom-camera-stream" className="w-full h-full"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
