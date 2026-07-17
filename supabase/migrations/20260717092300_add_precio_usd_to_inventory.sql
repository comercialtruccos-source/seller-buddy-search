-- Migración para agregar la columna precio_usd a la tabla inventory
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS precio_usd numeric DEFAULT 0;
