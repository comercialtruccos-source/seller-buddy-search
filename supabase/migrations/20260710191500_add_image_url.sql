-- Migration to add image_url column to inventory table
ALTER TABLE public.inventory ADD COLUMN image_url text NOT NULL DEFAULT '';
