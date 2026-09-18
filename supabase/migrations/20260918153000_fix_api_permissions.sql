-- ============================================================
-- Permisos y Políticas RLS para la API pública de solo lectura
-- ============================================================

-- Otorgar ejecución de funciones RPC a los roles anon y authenticated
GRANT EXECUTE ON FUNCTION public.api_list_references(text[], text, text, text, text, boolean, timestamptz, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_inventory_stats() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_consume_key(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_norm(text) TO anon, authenticated, service_role;

-- Otorgar permisos de tablas para api_keys y api_request_logs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_request_logs TO anon, authenticated, service_role;

-- Políticas RLS para api_keys
DROP POLICY IF EXISTS "Anyone can view api_keys" ON public.api_keys;
CREATE POLICY "Anyone can view api_keys"
  ON public.api_keys FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert api_keys" ON public.api_keys;
CREATE POLICY "Anyone can insert api_keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update api_keys" ON public.api_keys;
CREATE POLICY "Anyone can update api_keys"
  ON public.api_keys FOR UPDATE
  USING (true) WITH CHECK (true);

-- Políticas RLS para api_request_logs
DROP POLICY IF EXISTS "Anyone can view api_request_logs" ON public.api_request_logs;
CREATE POLICY "Anyone can view api_request_logs"
  ON public.api_request_logs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert api_request_logs" ON public.api_request_logs;
CREATE POLICY "Anyone can insert api_request_logs"
  ON public.api_request_logs FOR INSERT
  WITH CHECK (true);
