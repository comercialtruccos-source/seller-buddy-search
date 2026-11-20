ALTER TABLE public.clientes_mora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargas_clientes_mora ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clientes_mora FROM anon, authenticated;
REVOKE ALL ON public.cargas_clientes_mora FROM anon, authenticated;
GRANT ALL ON public.clientes_mora TO service_role;
GRANT ALL ON public.cargas_clientes_mora TO service_role;