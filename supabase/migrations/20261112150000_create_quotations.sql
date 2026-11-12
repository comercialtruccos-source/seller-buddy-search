-- Migration: Create quotations table and security policies
-- For storing quotations and tracking their approval status for HGI export

CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_number text NOT NULL,
  customer_name text NOT NULL,
  advisor_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'COP',
  cop_price_type text NOT NULL DEFAULT 'PVM',
  total_units integer NOT NULL DEFAULT 0,
  total_references integer NOT NULL DEFAULT 0,
  subtotal_catalogo numeric NOT NULL DEFAULT 0,
  subtotal_sin_iva numeric NOT NULL DEFAULT 0,
  total_iva numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  total_discount numeric NOT NULL DEFAULT 0,
  tier_badge text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendiente',
  approved_at timestamptz,
  approved_by text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotations_customer_name ON public.quotations(customer_name);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON public.quotations(created_at DESC);

-- Enable RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- Policies for quotations
CREATE POLICY "Anyone can view quotations" ON public.quotations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert quotations" ON public.quotations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update quotations" ON public.quotations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete quotations" ON public.quotations FOR DELETE USING (true);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
