-- ============================================================
-- API pública de solo lectura: llaves, registro de uso y consultas
-- ============================================================

CREATE TABLE public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  rate_limit_per_minute integer NOT NULL DEFAULT 120 CHECK (rate_limit_per_minute BETWEEN 1 AND 10000),
  request_count bigint NOT NULL DEFAULT 0,
  rejected_count bigint NOT NULL DEFAULT 0,
  window_start timestamptz,
  window_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  last_endpoint text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.api_request_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  status integer NOT NULL,
  duration_ms integer,
  ip text,
  user_agent text,
  query text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX api_request_logs_key_created_idx ON public.api_request_logs (api_key_id, created_at DESC);
CREATE INDEX api_request_logs_created_idx ON public.api_request_logs (created_at);

GRANT ALL ON public.api_request_logs TO service_role;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS inventory_sku_idx ON public.inventory (sku);
CREATE INDEX IF NOT EXISTS inventory_created_at_idx ON public.inventory (created_at);

-- ------------------------------------------------------------
-- Validación de llave + límite por minuto
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_consume_key(p_key_hash text, p_endpoint text)
RETURNS TABLE (
  key_id uuid,
  key_name text,
  allowed boolean,
  reason text,
  rate_limit integer,
  remaining integer,
  retry_after integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k public.api_keys%ROWTYPE;
  win_start timestamptz := date_trunc('minute', now());
  new_count integer;
BEGIN
  SELECT * INTO k FROM public.api_keys WHERE key_hash = p_key_hash FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, 'invalid_key'::text, 0, 0, 0;
    RETURN;
  END IF;

  IF k.revoked_at IS NOT NULL THEN
    UPDATE public.api_keys SET rejected_count = rejected_count + 1 WHERE id = k.id;
    RETURN QUERY SELECT k.id, k.name, false, 'revoked'::text, k.rate_limit_per_minute, 0, 0;
    RETURN;
  END IF;

  IF k.expires_at IS NOT NULL AND k.expires_at < now() THEN
    UPDATE public.api_keys SET rejected_count = rejected_count + 1 WHERE id = k.id;
    RETURN QUERY SELECT k.id, k.name, false, 'expired'::text, k.rate_limit_per_minute, 0, 0;
    RETURN;
  END IF;

  IF k.window_start IS NULL OR k.window_start < win_start THEN
    k.window_start := win_start;
    k.window_count := 0;
  END IF;

  IF k.window_count >= k.rate_limit_per_minute THEN
    UPDATE public.api_keys
      SET window_start = k.window_start,
          window_count = k.window_count,
          rejected_count = rejected_count + 1
      WHERE id = k.id;
    RETURN QUERY SELECT
      k.id, k.name, false, 'rate_limited'::text, k.rate_limit_per_minute, 0,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (win_start + interval '1 minute' - now())))::integer);
    RETURN;
  END IF;

  new_count := k.window_count + 1;

  UPDATE public.api_keys
    SET window_start = k.window_start,
        window_count = new_count,
        request_count = request_count + 1,
        last_used_at = now(),
        last_endpoint = p_endpoint
    WHERE id = k.id;

  RETURN QUERY SELECT k.id, k.name, true, 'ok'::text, k.rate_limit_per_minute, k.rate_limit_per_minute - new_count, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.api_consume_key(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_consume_key(text, text) TO service_role;

-- ------------------------------------------------------------
-- Normalización de texto (minúsculas, sin tildes)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_norm(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT translate(lower(t), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio');
$$;

REVOKE ALL ON FUNCTION public.api_norm(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_norm(text) TO service_role;

-- ------------------------------------------------------------
-- Listado / búsqueda paginada de referencias
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_list_references(
  p_words text[] DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_talla text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_bodega text DEFAULT NULL,
  p_con_stock boolean DEFAULT false,
  p_desde timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH reserved AS (
  SELECT sku, COALESCE(SUM(cantidad), 0)::integer AS qty
  FROM public.order_items
  GROUP BY sku
),
base AS (
  SELECT i.referencia, i.descripcion, i.talla, i.color, i.cod_color, i.sku, i.bodega,
         i.pvm, i.pvp, COALESCE(i.precio_usd, 0) AS precio_usd, i.image_url, i.created_at,
         i.saldo,
         GREATEST(0, i.saldo - COALESCE(r.qty, 0)) AS disponible
  FROM public.inventory i
  LEFT JOIN reserved r ON r.sku = i.sku
),
candidates AS (
  SELECT DISTINCT b.referencia
  FROM base b
  WHERE (p_talla IS NULL OR public.api_norm(b.talla) = public.api_norm(p_talla))
    AND (p_color IS NULL OR public.api_norm(b.color) LIKE '%' || public.api_norm(p_color) || '%')
    AND (p_bodega IS NULL OR public.api_norm(b.bodega) = public.api_norm(p_bodega))
    AND (NOT p_con_stock OR b.disponible > 0)
    AND (p_desde IS NULL OR b.created_at >= p_desde)
),
searched AS (
  SELECT c.referencia
  FROM candidates c
  WHERE p_words IS NULL
     OR cardinality(p_words) = 0
     OR (
       p_code IS NOT NULL AND length(p_code) >= 3 AND EXISTS (
         SELECT 1 FROM public.inventory i
         WHERE i.referencia = c.referencia
           AND (
             regexp_replace(lower(i.referencia), '[^a-z0-9]', '', 'g') LIKE '%' || p_code || '%'
             OR p_code LIKE '%' || regexp_replace(lower(i.referencia), '[^a-z0-9]', '', 'g') || '%'
             OR regexp_replace(lower(i.sku), '[^a-z0-9]', '', 'g') LIKE '%' || p_code || '%'
           )
       )
     )
     OR NOT EXISTS (
       SELECT 1 FROM unnest(p_words) AS w
       WHERE NOT EXISTS (
         SELECT 1 FROM public.inventory i
         WHERE i.referencia = c.referencia
           AND (
             public.api_norm(i.referencia) LIKE '%' || w || '%'
             OR public.api_norm(i.descripcion) LIKE '%' || w || '%'
             OR public.api_norm(i.color) LIKE '%' || w || '%'
             OR public.api_norm(i.sku) LIKE '%' || w || '%'
           )
       )
     )
),
agg AS (
  SELECT b.referencia,
         (array_agg(b.descripcion ORDER BY b.created_at DESC, b.sku))[1] AS descripcion,
         MAX(b.pvp) AS pvp,
         MAX(b.pvm) AS pvm,
         MAX(b.precio_usd) AS precio_usd,
         SUM(b.disponible)::integer AS saldo_disponible,
         SUM(b.saldo)::integer AS saldo_fisico,
         COUNT(DISTINCT b.sku)::integer AS total_skus,
         COALESCE(MAX(NULLIF(b.image_url, '')), '') AS imagen_url,
         MAX(b.created_at) AS actualizado_en,
         COALESCE(array_agg(DISTINCT b.talla) FILTER (WHERE b.talla <> ''), '{}') AS tallas,
         COALESCE(array_agg(DISTINCT b.color) FILTER (WHERE b.color <> ''), '{}') AS colores,
         COALESCE(array_agg(DISTINCT b.bodega) FILTER (WHERE b.bodega <> ''), '{}') AS bodegas
  FROM base b
  JOIN searched s ON s.referencia = b.referencia
  GROUP BY b.referencia
),
total AS (SELECT COUNT(*) AS c FROM agg),
page AS (
  SELECT * FROM agg
  ORDER BY referencia
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset)
)
SELECT jsonb_build_object(
  'total', (SELECT c FROM total),
  'items', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.referencia) FROM page p), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.api_list_references(text[], text, text, text, text, boolean, timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_list_references(text[], text, text, text, text, boolean, timestamptz, integer, integer) TO service_role;

-- ------------------------------------------------------------
-- Resumen / estado del inventario
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.api_inventory_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH reserved AS (
  SELECT sku, COALESCE(SUM(cantidad), 0)::integer AS qty
  FROM public.order_items
  GROUP BY sku
),
base AS (
  SELECT i.*, GREATEST(0, i.saldo - COALESCE(r.qty, 0)) AS disponible
  FROM public.inventory i
  LEFT JOIN reserved r ON r.sku = i.sku
)
SELECT jsonb_build_object(
  'actualizado_en', (SELECT MAX(created_at) FROM public.inventory),
  'total_registros', (SELECT COUNT(*) FROM public.inventory),
  'total_referencias', (SELECT COUNT(DISTINCT referencia) FROM public.inventory),
  'total_skus', (SELECT COUNT(DISTINCT sku) FROM public.inventory),
  'unidades_fisicas', (SELECT COALESCE(SUM(saldo), 0) FROM public.inventory),
  'unidades_disponibles', (SELECT COALESCE(SUM(disponible), 0) FROM base),
  'unidades_reservadas', (SELECT COALESCE(SUM(cantidad), 0) FROM public.order_items),
  'bodegas', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', x.bodega, 'registros', x.c, 'unidades', x.u) ORDER BY x.bodega), '[]'::jsonb)
    FROM (SELECT bodega, COUNT(*) AS c, COALESCE(SUM(saldo), 0) AS u FROM public.inventory GROUP BY bodega) x
  ),
  'tallas', (SELECT COALESCE(jsonb_agg(DISTINCT talla), '[]'::jsonb) FROM public.inventory WHERE talla <> ''),
  'colores', (SELECT COALESCE(jsonb_agg(DISTINCT color), '[]'::jsonb) FROM public.inventory WHERE color <> '')
);
$$;

REVOKE ALL ON FUNCTION public.api_inventory_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_inventory_stats() TO service_role;