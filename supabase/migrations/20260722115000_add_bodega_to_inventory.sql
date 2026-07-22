-- Add bodega column to inventory table
ALTER TABLE public.inventory
ADD COLUMN bodega text NOT NULL DEFAULT 'Principal';

CREATE INDEX IF NOT EXISTS inventory_bodega_idx ON public.inventory (bodega);
