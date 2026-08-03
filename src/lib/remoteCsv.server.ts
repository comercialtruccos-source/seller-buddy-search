import * as XLSX from "xlsx";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/csv,text/plain,application/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
};

/** Preferred sheet names when the remote file is an Excel workbook. */
const PREFERRED_SHEETS = ["Buscador Referencias", "BUSCADOR REFERENCIAS", "Buscador"];

/**
 * Build a list of candidate direct-download URLs for a OneDrive / SharePoint
 * personal share link. Modern personal accounts are migrated to SharePoint,
 * so onedrive.live.com blocks anonymous downloads and the working endpoint is
 * my.microsoftpersonalcontent.com/personal/<cid>/_layouts/15/download.aspx?share=<token>
 */
export function buildOneDriveDownloadUrls(rawUrl: string): string[] {
  const urls: string[] = [];
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    const isOneDrive =
      host.includes("onedrive.live.com") ||
      host.includes("1drv.ms") ||
      host.includes("sharepoint.com") ||
      host.includes("microsoftpersonalcontent.com");
    if (!isOneDrive) return urls;

    const parts = u.pathname.split("/").filter(Boolean);

    // onedrive.live.com/:x:/g/personal/<cid>/<shareToken>
    const personalIdx = parts.indexOf("personal");
    if (personalIdx !== -1 && parts.length > personalIdx + 2) {
      const cid = parts[personalIdx + 1];
      const token = parts[personalIdx + 2];
      urls.push(
        `https://my.microsoftpersonalcontent.com/personal/${cid.toLowerCase()}/_layouts/15/download.aspx?share=${token}`,
      );
    }

    // 1drv.ms/x/c/<cid>/<shareToken>
    if (host.includes("1drv.ms")) {
      const cIdx = parts.indexOf("c");
      if (cIdx !== -1 && parts.length > cIdx + 2) {
        const cid = parts[cIdx + 1];
        const token = parts[cIdx + 2];
        urls.push(
          `https://my.microsoftpersonalcontent.com/personal/${cid.toLowerCase()}/_layouts/15/download.aspx?share=${token}`,
        );
      }
    }

    // SharePoint style links: <site>/:x:/g/... -> append download=1
    if (host.includes("sharepoint.com")) {
      const sp = new URL(rawUrl);
      sp.searchParams.set("download", "1");
      urls.push(sp.toString());
    }
  } catch {
    // ignore malformed URLs
  }
  return urls;
}

/** Convert an Excel workbook buffer to CSV text using the inventory sheet. */
export function workbookToCsv(buffer: ArrayBuffer): string {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const names = wb.SheetNames;

  let sheetName =
    names.find((n) => PREFERRED_SHEETS.some((p) => n.trim().toLowerCase() === p.toLowerCase())) ??
    names.find((n) => n.trim().toLowerCase().includes("buscador"));

  if (!sheetName) {
    // Fall back to the first sheet whose header row contains "Referencia".
    for (const n of names) {
      const csvHead = XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false }).slice(0, 400).toLowerCase();
      if (csvHead.includes("referencia") && csvHead.includes("saldo")) {
        sheetName = n;
        break;
      }
    }
  }

  if (!sheetName) sheetName = names[0];
  if (!sheetName) throw new Error("El archivo de Excel no contiene hojas.");

  return XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { blankrows: false });
}

function looksLikeExcel(bytes: Uint8Array, contentType: string): boolean {
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return true;
  // XLSX/XLSM are ZIP archives ("PK"), legacy XLS starts with D0 CF 11 E0.
  return (
    (bytes[0] === 0x50 && bytes[1] === 0x4b) ||
    (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)
  );
}

/**
 * Download a remote inventory file (CSV, XLSX/XLSM or a OneDrive share link)
 * and return it as CSV text.
 */
export async function fetchRemoteInventoryCsv(rawUrl: string): Promise<string> {
  const candidates = [...buildOneDriveDownloadUrls(rawUrl), rawUrl];

  let lastError = "";
  for (const candidate of candidates) {
    let response: Response;
    try {
      response = await fetch(candidate, { headers: BROWSER_HEADERS, redirect: "follow" });
    } catch (e: any) {
      lastError = e?.message || "No se pudo conectar con el servidor remoto.";
      continue;
    }

    if (!response.ok) {
      lastError = `Error de servidor remoto: ${response.status} ${response.statusText}`;
      continue;
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 8));

    if (looksLikeExcel(bytes, contentType)) {
      return workbookToCsv(buffer);
    }

    const text = new TextDecoder("utf-8").decode(buffer);
    if (contentType.includes("text/html") || text.trimStart().toLowerCase().startsWith("<!doctype")) {
      lastError =
        "El enlace requiere iniciar sesión (Microsoft / OneDrive) y no permite la descarga directa. Comparte el archivo con permiso «Cualquier persona con el vínculo».";
      continue;
    }

    return text;
  }

  throw new Error(lastError || "No fue posible descargar el archivo desde la URL.");
}
