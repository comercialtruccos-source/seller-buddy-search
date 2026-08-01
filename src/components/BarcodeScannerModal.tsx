import React, { useEffect, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X } from "lucide-react";
import { toast } from "sonner";

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

  useEffect(() => {
    if (!open) return;

    setIsInitializing(true);
    let scanner: Html5QrcodeScanner | null = null;

    try {
      scanner = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
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

      scanner.render(
        (decodedText) => {
          // Play a simple beep sound on success if supported by browser
          try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
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
          } catch (e) {
            // Ignore if audio isn't supported or allowed yet
          }

          if (scanner) {
            scanner.clear();
          }
          onScan(decodedText);
        },
        (errorMessage) => {
          // We can ignore continuous scanning errors
        }
      );
      
      // Delaying the initialization state to hide the loading skeleton
      setTimeout(() => setIsInitializing(false), 800);
    } catch (error) {
      console.error("Error initializing scanner:", error);
      toast.error("No se pudo acceder a la cámara.");
      setIsInitializing(false);
      onClose();
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [open, onScan, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h2 className="text-lg font-bold text-foreground">
            Escanear Código
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
            Apunta la cámara al código de barras o código QR de la prenda para buscar su referencia.
          </p>

          <div className="w-full relative bg-black/5 rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center">
            {isInitializing && (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 text-muted-foreground z-10 bg-card/80 backdrop-blur-sm">
                <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
                <p className="text-sm font-medium">Iniciando cámara...</p>
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
