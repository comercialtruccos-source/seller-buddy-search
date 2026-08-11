import React, { useEffect, useState, useRef } from "react";
import { X, Upload, Camera, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { scanTagImage } from "@/lib/tagScanner";

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
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImageFile = async (file: File) => {
    setIsProcessingFile(true);
    setStatusMessage("Iniciando análisis inteligente de la foto...");

    try {
      const result = await scanTagImage(file, (msg) => setStatusMessage(msg));
      if (result) {
        const methodLabel =
          result.method === "ocr-text"
            ? "Texto impreso en etiqueta (OCR)"
            : "Código de barras";
        toast.success(`Referencia/SKU detectada (${methodLabel}): ${result.sku}`);
        onScan(result.sku);
        onClose();
      } else {
        toast.error(
          "No se detectó un código o referencia en la foto. Intenta con una imagen más clara o usa la cámara en vivo."
        );
      }
    } catch (err) {
      console.error("Error processing tag image:", err);
      toast.error("Error al procesar la imagen de la etiqueta.");
    } finally {
      setIsProcessingFile(false);
      setStatusMessage("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    if (!open) return;

    setIsInitializing(true);
    let scannerInstance: any = null;
    let isMounted = true;

    // Intercept file selection from html5-qrcode's internal UI if user clicks it
    const readerContainer = document.getElementById("reader");
    const handleInternalFileChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target && target.type === "file" && target.files && target.files.length > 0) {
        const file = target.files[0];
        processImageFile(file);
      }
    };

    readerContainer?.addEventListener("change", handleInternalFileChange, true);

    // Dynamically import html5-qrcode on client side only to prevent SSR crashes
    import("html5-qrcode")
      .then(({ Html5QrcodeScanner, Html5QrcodeSupportedFormats }) => {
        if (!isMounted) return;

        try {
          const scanner = new Html5QrcodeScanner(
            "reader",
            {
              fps: 10,
              qrbox: { width: 260, height: 160 },
              aspectRatio: 1.0,
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: true,
              },
              formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.QR_CODE,
              ],
            },
            /* verbose= */ false
          );
          scannerInstance = scanner;

          scanner.render(
            (decodedText) => {
              // Play a simple beep sound on success if supported by browser
              try {
                if (typeof window !== "undefined") {
                  const AudioContextClass =
                    window.AudioContext || (window as any).webkitAudioContext;
                  if (AudioContextClass) {
                    const context = new AudioContextClass();
                    const oscillator = context.createOscillator();
                    const gain = context.createGain();
                    oscillator.connect(gain);
                    gain.connect(context.destination);
                    oscillator.type = "sine";
                    oscillator.frequency.value = 800;
                    gain.gain.setValueAtTime(0, context.currentTime);
                    gain.gain.linearRampToValueAtTime(1, context.currentTime + 0.05);
                    gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.2);
                    oscillator.start(context.currentTime);
                    oscillator.stop(context.currentTime + 0.2);
                  }
                }
              } catch (e) {
                // Ignore audio errors on iOS
              }

              if (scannerInstance) {
                scannerInstance.clear().catch(console.error);
              }
              onScan(decodedText);
            },
            (errorMessage) => {
              // Ignore continuous scan errors
            }
          );

          if (isMounted) {
            setTimeout(() => setIsInitializing(false), 800);
          }
        } catch (error) {
          console.error("Error initializing scanner:", error);
          toast.error("No se pudo acceder a la cámara.");
          setIsInitializing(false);
          onClose();
        }
      })
      .catch((err) => {
        console.error("Error loading html5-qrcode:", err);
        toast.error("No se pudo cargar la librería de la cámara.");
        setIsInitializing(false);
      });

    return () => {
      isMounted = false;
      readerContainer?.removeEventListener("change", handleInternalFileChange, true);
      if (scannerInstance) {
        scannerInstance.clear().catch(console.error);
      }
    };
  }, [open, onScan, onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processImageFile(files[0]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <style>{`
        #reader { border: none !important; }
        #reader button { background-color: var(--primary); color: white; border-radius: 8px; padding: 6px 12px; font-size: 13px; }
        #reader__status_span { display: none !important; }
        .html5-qrcode-element-error { display: none !important; }
      `}</style>
      <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Escanear Código o Etiqueta
          </h2>
          <button
            onClick={onClose}
            className="p-2 bg-muted/50 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner Body */}
        <div className="p-4 flex flex-col items-center">
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Apunta la cámara al código de barras o sube una foto de la etiqueta para leer la referencia por código o texto.
          </p>

          {/* Action Button: Subir foto con escáner inteligente / OCR */}
          <div className="w-full mb-3 flex flex-col gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium shadow-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isProcessingFile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{statusMessage || "Analizando foto..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                  <Upload className="h-4 w-4" />
                  <span>Subir / Tomar Foto de Etiqueta (Escanear + OCR)</span>
                </>
              )}
            </button>
          </div>

          <div className="w-full relative bg-black/5 rounded-xl overflow-hidden min-h-[280px] flex items-center justify-center">
            {(isInitializing || isProcessingFile) && (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-muted-foreground z-10 bg-card/90 backdrop-blur-sm p-4 text-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <p className="text-sm font-medium">
                  {isProcessingFile
                    ? statusMessage || "Procesando imagen con IA/OCR..."
                    : "Iniciando cámara..."}
                </p>
              </div>
            )}
            {/* The element where html5-qrcode mounts its UI */}
            <div id="reader" className="w-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
