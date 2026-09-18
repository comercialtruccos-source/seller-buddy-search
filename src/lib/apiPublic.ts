import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://xdssybdyksxymjmloxqp.supabase.co";
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_v9seuRqhqBcnBvv8-x0zkg_J43brvVi";
  return createClient<Database>(url, key);
}

/** Server-side function to get inventory stats. Bypasses browser CSP. */
export const getPublicInventoryStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("api_inventory_stats");
    if (error) throw new Error(error.message);
    return data;
  });

/** Server-side function to query references list. Bypasses browser CSP. */
export const getPublicReferences = createServerFn({ method: "POST" })
  .validator((data: { limit?: number; offset?: number; conStock?: boolean; code?: string }) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabaseClient();
    const { data: result, error } = await supabase.rpc("api_list_references", {
      p_limit: data.limit ?? 50,
      p_offset: data.offset ?? 0,
      p_con_stock: data.conStock ?? false,
      p_code: data.code || undefined,
    });
    if (error) throw new Error(error.message);
    return result;
  });
