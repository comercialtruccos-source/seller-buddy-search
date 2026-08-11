import { extractBaseSku } from "./inventory";

/**
 * Interface for barcode/tag scan result.
 */
export interface ScanResult {
  code: string;
  sku: string;
  method: "barcode-native" | "barcode-zxing" | "ocr-text";
}

/**
 * Native BarcodeDetector interface for TypeScript.
 */
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

/**
 * Creates a canvas with custom rotation (0, 90, 180, 270 deg) and optional contrast enhancement.
 */
function createRotatedCanvas(
  img: HTMLImageElement,
  maxWidth: number,
  angleDegrees: number,
  contrast: boolean = false
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  let srcW = img.naturalWidth || img.width;
  let srcH = img.naturalHeight || img.height;

  if (srcW > maxWidth) {
    srcH = Math.round((srcH * maxWidth) / srcW);
    srcW = maxWidth;
  }

  const is90or270 = angleDegrees === 90 || angleDegrees === 270;
  canvas.width = is90or270 ? srcH : srcW;
  canvas.height = is90or270 ? srcW : srcH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angleDegrees * Math.PI) / 180);
  ctx.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (contrast) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const v = avg > 125 ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

/**
 * Convert canvas to File object for html5-qrcode.
 */
function canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(new File([blob], filename, { type: "image/jpeg" }));
      } else {
        reject(new Error("Canvas blob creation failed"));
      }
    }, "image/jpeg", 0.9);
  });
}

/**
 * Scans an image File testing all 4 rotation angles (0°, 90°, 180°, 270°),
 * multi-scale resolutions, and high-contrast thresholding.
 */
export async function scanTagImage(
  imageFile: File,
  onStatusUpdate?: (status: string) => void
): Promise<ScanResult | null> {
  onStatusUpdate?.("Cargando foto...");

  // Load File into HTMLImageElement
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });

  const angles = [0, 90, 270, 180];
  const scales = [1000, 700];

  // --- LAYER 1: Native BarcodeDetector across rotated angles ---
  if (typeof window !== "undefined" && window.BarcodeDetector) {
    try {
      onStatusUpdate?.("Analizando código de barras (Lector nativo)...");
      const detector = new window.BarcodeDetector({
        formats: [
          "code_128",
          "code_39",
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "qr_code",
        ],
      });

      for (const angle of angles) {
        const canvas = createRotatedCanvas(img, 1000, angle, false);
        const barcodes = await detector.detect(canvas);
        if (barcodes && barcodes.length > 0) {
          const rawCode = barcodes[0].rawValue;
          if (rawCode) {
            const sku = extractBaseSku(rawCode);
            return { code: rawCode, sku, method: "barcode-native" };
          }
        }
      }
    } catch (e) {
      console.warn("Native BarcodeDetector failed, proceeding to ZXing multi-angle scan", e);
    }
  }

  // --- LAYER 2: HTML5-QRCode / ZXing across 4 Angles & Contrast Variations ---
  try {
    onStatusUpdate?.("Optimizando resolución y ángulos de escaneo...");
    const { Html5Qrcode } = await import("html5-qrcode");
    const tempElementId = "temp-qr-reader-" + Date.now();
    const tempDiv = document.createElement("div");
    tempDiv.id = tempElementId;
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);

    const html5Qrcode = new Html5Qrcode(tempElementId);

    for (const scale of scales) {
      for (const angle of angles) {
        for (const contrast of [false, true]) {
          const rotatedCanvas = createRotatedCanvas(img, scale, angle, contrast);
          const tempFile = await canvasToFile(rotatedCanvas, `temp-${scale}-${angle}.jpg`);
          try {
            const res = await html5Qrcode.scanFileV2(tempFile, true);
            if (res && res.decodedText) {
              html5Qrcode.clear().catch(() => {});
              if (document.body.contains(tempDiv)) {
                document.body.removeChild(tempDiv);
              }
              const sku = extractBaseSku(res.decodedText);
              return { code: res.decodedText, sku, method: "barcode-zxing" };
            }
          } catch (err) {
            // Continue scanning next orientation/contrast
          }
        }
      }
    }

    html5Qrcode.clear().catch(() => {});
    if (document.body.contains(tempDiv)) {
      document.body.removeChild(tempDiv);
    }
  } catch (e) {
    console.warn("ZXing multi-angle scanning failed, trying OCR fallback", e);
  }

  // --- LAYER 3: Tesseract.js OCR Text Recognition Fallback ---
  try {
    onStatusUpdate?.("Buscando referencia impresa en la etiqueta (OCR)...");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");

    const ocrCanvas = createRotatedCanvas(img, 1000, 0, false);
    const ret = await worker.recognize(ocrCanvas);
    await worker.terminate();

    const recognizedText = ret.data.text || "";
    console.log("OCR Recognized Text:", recognizedText);

    // Match REF: T12032107 or T12032107S580 patterns
    const refMatch = recognizedText.match(/REF\s*[:\.-]?\s*([a-zA-Z]\d{8})/i);
    if (refMatch) {
      const foundRef = refMatch[1].toUpperCase();
      return { code: foundRef, sku: foundRef, method: "ocr-text" };
    }

    const codeMatch = recognizedText.match(/\b([a-zA-Z]\d{8})\b/);
    if (codeMatch) {
      const foundCode = codeMatch[1].toUpperCase();
      return { code: foundCode, sku: foundCode, method: "ocr-text" };
    }

    const variantMatch = recognizedText.match(/\b([a-zA-Z]\d{8}[a-zA-Z0-9]{2,5})\b/);
    if (variantMatch) {
      const rawCode = variantMatch[1].toUpperCase();
      const sku = extractBaseSku(rawCode);
      return { code: rawCode, sku, method: "ocr-text" };
    }

    const numMatch = recognizedText.match(/\b(\d{8,13})\b/);
    if (numMatch) {
      const numCode = numMatch[1];
      return { code: numCode, sku: numCode, method: "ocr-text" };
    }
  } catch (ocrErr) {
    console.warn("OCR fallback error:", ocrErr);
  }

  return null;
}
