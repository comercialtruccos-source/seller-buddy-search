CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sku text NOT NULL,
  referencia text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  talla text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  cod_color text NOT NULL DEFAULT '',
  pvm numeric NOT NULL DEFAULT 0,
  cantidad integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policies for orders
CREATE POLICY "Anyone can view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete orders" ON public.orders FOR DELETE USING (true);

-- Policies for order_items
CREATE POLICY "Anyone can view order_items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert order_items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update order_items" ON public.order_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete order_items" ON public.order_items FOR DELETE USING (true);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
