import { createServerFn } from "@tanstack/react-start";

interface ShopifySuggestResult {
  resources: {
    results: {
      products: Array<{
        title: string;
        image: string;
        url: string;
        handle: string;
        body: string;
      }>;
    };
  };
}

export const getShopifyProductImage = createServerFn({ method: "GET" })
  .validator((referencia: string) => referencia)
  .handler(async ({ data: referencia }) => {
    try {
      if (!referencia) return null;
      
      const url = `https://truccos.com.co/search/suggest.json?q=${encodeURIComponent(referencia)}&resources[type]=product`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch from Shopify: ${response.statusText}`);
      }

      const data = (await response.json()) as ShopifySuggestResult;
      const products = data.resources?.results?.products ?? [];

      // Find the product whose handle matches the reference code, or falls back to any result
      const refUpper = referencia.toUpperCase();

      const match = products.find(
        (p) =>
          p.handle?.toUpperCase() === refUpper ||
          p.body?.toUpperCase().includes(`REF: ${refUpper}`) ||
          p.title?.toUpperCase().includes(refUpper)
      ) || products[0];

      return match
        ? {
            imageUrl: match.image,
            shopifyUrl: `https://truccos.com.co${match.url}`,
          }
        : null;
    } catch (error) {
      console.error(`Error fetching image for ref ${referencia}:`, error);
      return null;
    }
  });

export const downloadCsvFromUrl = createServerFn({ method: "GET" })
  .validator((url: string) => url)
  .handler(async ({ data: url }) => {
    try {
      if (!url) return "";
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/csv,text/plain,application/csv,*/*",
        },
      });

      if (!response.ok) {
        throw new Error(`Error de servidor remoto: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        throw new Error("El enlace requiere iniciar sesión (Microsoft / OneDrive) y no permite la descarga directa de datos.");
      }

      const text = await response.text();
      return text;
    } catch (error: any) {
      console.error(`Error downloading CSV from URL ${url}:`, error);
      throw new Error(error.message || "Error al descargar el archivo desde el servidor");
    }
  });
