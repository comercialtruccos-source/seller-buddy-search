CREATE TABLE public.inventory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referencia text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  talla_lote text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  saldo integer NOT NULL DEFAULT 0,
  talla text NOT NULL DEFAULT '',
  cod_color text NOT NULL DEFAULT '',
  sku text NOT NULL DEFAULT '',
  pvm numeric NOT NULL DEFAULT 0,
  pvp numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_referencia_idx ON public.inventory (referencia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view inventory"
  ON public.inventory FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert inventory"
  ON public.inventory FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update inventory"
  ON public.inventory FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete inventory"
  ON public.inventory FOR DELETE
  USING (true);