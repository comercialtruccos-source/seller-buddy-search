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
 * Preprocesses an image element onto a canvas with scaling and optional high contrast.
 */
function createScaledCanvas(
  img: HTMLImageElement,
  maxWidth: number,
  contrast: boolean = false
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0, width, height);

  if (contrast) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    // Apply grayscale + high contrast thresholding
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const v = avg > 128 ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

/**
 * Convert canvas to File object.
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
 * Scans an image File using:
 * 1. Native Browser BarcodeDetector (iOS Safari 17+, Chrome)
 * 2. Multi-scale HTML5-QRCode (ZXing) with scaled canvas
 * 3. Tesseract.js OCR fallback for printed text on clothing tags
 */
export async function scanTagImage(
  imageFile: File,
  onStatusUpdate?: (status: string) => void
): Promise<ScanResult | null> {
  onStatusUpdate?.("Analizando imagen...");

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

  // --- LAYER 1: Native BarcodeDetector ---
  if (typeof window !== "undefined" && window.BarcodeDetector) {
    try {
      onStatusUpdate?.("Buscando código de barras nativo...");
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
      const barcodes = await detector.detect(img);
      if (barcodes && barcodes.length > 0) {
        const rawCode = barcodes[0].rawValue;
        if (rawCode) {
          const sku = extractBaseSku(rawCode);
          return { code: rawCode, sku, method: "barcode-native" };
        }
      }
    } catch (e) {
      console.warn("Native BarcodeDetector failed, falling back to multi-scale ZXing", e);
    }
  }

  // --- LAYER 2: Multi-Scale ZXing Scanning via html5-qrcode ---
  try {
    onStatusUpdate?.("Buscando código en diferentes resoluciones...");
    const { Html5Qrcode } = await import("html5-qrcode");
    const tempElementId = "temp-qr-reader-" + Date.now();
    const tempDiv = document.createElement("div");
    tempDiv.id = tempElementId;
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);

    const html5Qrcode = new Html5Qrcode(tempElementId);

    // Try original file first
    try {
      const res = await html5Qrcode.scanFileV2(imageFile, true);
      if (res && res.decodedText) {
        html5Qrcode.clear();
        document.body.removeChild(tempDiv);
        const sku = extractBaseSku(res.decodedText);
        return { code: res.decodedText, sku, method: "barcode-zxing" };
      }
    } catch (err) {
      // Ignore original resolution failure, proceed to scaled versions
    }

    // Try scaled canvas versions (1200px, 800px)
    const scales = [1200, 800];
    for (const scale of scales) {
      const scaledCanvas = createScaledCanvas(img, scale, false);
      const scaledFile = await canvasToFile(scaledCanvas, `scaled-${scale}.jpg`);
      try {
        const res = await html5Qrcode.scanFileV2(scaledFile, true);
        if (res && res.decodedText) {
          html5Qrcode.clear();
          document.body.removeChild(tempDiv);
          const sku = extractBaseSku(res.decodedText);
          return { code: res.decodedText, sku, method: "barcode-zxing" };
        }
      } catch (e) {
        // Continue to next scale
      }
    }

    html5Qrcode.clear().catch(() => {});
    if (document.body.contains(tempDiv)) {
      document.body.removeChild(tempDiv);
    }
  } catch (e) {
    console.warn("ZXing multi-scale scanning failed, trying OCR fallback", e);
  }

  // --- LAYER 3: OCR Text Recognition Fallback (Tesseract.js) ---
  try {
    onStatusUpdate?.("Leyendo texto e impresiones de la etiqueta (OCR)...");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    
    // Crop/Scale image for better OCR speed
    const ocrCanvas = createScaledCanvas(img, 1200, false);
    const ret = await worker.recognize(ocrCanvas);
    await worker.terminate();

    const recognizedText = ret.data.text;
    console.log("OCR Recognized Text:", recognizedText);

    // Regex to match SKU/Reference patterns (e.g., T12032107, B29107356, T12032107S580)
    // 1. Look for explicit REF: T12032107 or REF T12032107
    const refMatch = recognizedText.match(/REF\s*[:\.-]?\s*([a-zA-Z]\d{8})/i);
    if (refMatch) {
      const foundRef = refMatch[1].toUpperCase();
      return { code: foundRef, sku: foundRef, method: "ocr-text" };
    }

    // 2. Look for any 9-character reference starting with letter followed by 8 numbers (e.g. T12032107)
    const codeMatch = recognizedText.match(/\b([a-zA-Z]\d{8})\b/);
    if (codeMatch) {
      const foundCode = codeMatch[1].toUpperCase();
      return { code: foundCode, sku: foundCode, method: "ocr-text" };
    }

    // 3. Look for variant SKU pattern like T12032107S580
    const variantMatch = recognizedText.match(/\b([a-zA-Z]\d{8}[a-zA-Z0-9]{2,5})\b/);
    if (variantMatch) {
      const rawCode = variantMatch[1].toUpperCase();
      const sku = extractBaseSku(rawCode);
      return { code: rawCode, sku, method: "ocr-text" };
    }

    // 4. Look for numeric barcode numbers (8 to 13 digits)
    const numMatch = recognizedText.match(/\b(\d{8,13})\b/);
    if (numMatch) {
      const numCode = numMatch[1];
      return { code: numCode, sku: numCode, method: "ocr-text" };
    }
  } catch (ocrErr) {
    console.error("OCR recognition error:", ocrErr);
  }

  return null;
}
