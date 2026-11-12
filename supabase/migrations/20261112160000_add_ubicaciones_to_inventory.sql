-- Migration: Add ubicaciones column to inventory table
-- For tracking location in main warehouse and stores (bodega principal y tiendas)

ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS ubicaciones text DEFAULT '';

CREATE INDEX IF NOT EXISTS inventory_ubicaciones_idx ON public.inventory (ubicaciones);
