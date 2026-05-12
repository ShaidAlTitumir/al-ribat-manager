-- Al-Ribat Manager: Professional & Robust Database Schema
-- Goal: Fix "column does not exist" and "value too long" errors by ensuring all attributes are added explicitly.

-- 0. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- FORCE SYNC: Add missing columns and handle legacy column names
DO $$ 
BEGIN
  -- 1. Rename 'name' to 'full_name' if 'full_name' doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE public.profiles RENAME COLUMN name TO full_name;
  END IF;

  -- 2. Make 'name' nullable if it still exists (legacy compatibility)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name') THEN
    ALTER TABLE public.profiles ALTER COLUMN name DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Add unique constraint and lowercase check for username
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE(username);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_check CHECK (username = lower(username));
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Businesses Table
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  join_code TEXT UNIQUE NOT NULL DEFAULT substring(upper(md5(random()::text)) from 1 for 8), 
  exchange_rate DECIMAL DEFAULT 18.0,
  business_type TEXT DEFAULT 'partnership',
  currency TEXT DEFAULT 'BDT',
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Migration for Businesses: Fix "value too long for type character varying(6)"
-- Also drop any restrictive business_type check constraints
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_business_type_check') THEN
    ALTER TABLE public.businesses DROP CONSTRAINT businesses_business_type_check;
  END IF;
END $$;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'partnership';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL DEFAULT 18.0;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BDT';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.businesses ALTER COLUMN join_code TYPE TEXT;
ALTER TABLE public.businesses ALTER COLUMN join_code SET DEFAULT substring(upper(md5(random()::text)) from 1 for 8);

-- 3. Business Members
CREATE TABLE IF NOT EXISTS public.business_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
-- Add unique constraint if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_members_business_id_user_id_key') THEN
    ALTER TABLE public.business_members ADD CONSTRAINT business_members_business_id_user_id_key UNIQUE(business_id, user_id);
  END IF;
END $$;

-- 4. Partners Table
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS name TEXT NOT NULL;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS profit_share DECIMAL NOT NULL DEFAULT 0;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived'));

-- 5. Capital Contributions
CREATE TABLE IF NOT EXISTS public.capital_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.capital_contributions ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE;
ALTER TABLE public.capital_contributions ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.capital_contributions ADD COLUMN IF NOT EXISTS amount DECIMAL NOT NULL;
ALTER TABLE public.capital_contributions ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL CHECK (currency IN ('BDT', 'RMB'));
ALTER TABLE public.capital_contributions ADD COLUMN IF NOT EXISTS notes TEXT;

-- 6. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT NOT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_due_cents BIGINT DEFAULT 0;

-- 7. Inventory Items Table
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS sku TEXT NOT NULL;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS name TEXT NOT NULL;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs';
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS weight_per_unit DECIMAL DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS current_stock INT DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 5;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS default_selling_price_cents BIGINT DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS last_landed_cost_cents BIGINT DEFAULT 0;
-- Unique SKU per business
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_business_id_sku_key') THEN
    ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_business_id_sku_key UNIQUE(business_id, sku);
  END IF;
END $$;

-- 8. Purchase Transactions
CREATE TABLE IF NOT EXISTS public.purchase_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE;
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS quantity INT NOT NULL;
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS buying_cost_per_unit_rmb_cents BIGINT NOT NULL;
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS exchange_rate_used DECIMAL NOT NULL;
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS shipping_rate_bdt_per_kg_cents BIGINT DEFAULT 0;
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS additional_cost_bdt_cents BIGINT DEFAULT 0;
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS landed_cost_per_unit_bdt_cents BIGINT NOT NULL;
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS total_landed_cost_bdt_cents BIGINT NOT NULL;
ALTER TABLE public.purchase_transactions ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false;

-- 9. Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS invoice_no TEXT NOT NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES public.inventory_items(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS quantity INT NOT NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS unit_price_bdt_cents BIGINT NOT NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_cents BIGINT DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_cents BIGINT NOT NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS received_now_bdt_cents BIGINT DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_cents BIGINT DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS expected_profit_cents BIGINT DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cost_rate_cents BIGINT NOT NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS notes TEXT;

-- 10. Customer Ledger
CREATE TABLE IF NOT EXISTS public.customer_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'payment', 'return'));
ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS amount_cents BIGINT NOT NULL;
ALTER TABLE public.customer_ledger ADD COLUMN IF NOT EXISTS reference_id UUID;

-- 11. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS title TEXT NOT NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount_cents BIGINT NOT NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL CHECK (currency IN ('BDT', 'RMB'));

-- 12. Join Requests
CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'join_requests_business_id_user_id_key') THEN
    ALTER TABLE public.join_requests ADD CONSTRAINT join_requests_business_id_user_id_key UNIQUE(business_id, user_id);
  END IF;
END $$;

-- 13. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 14. Activity Log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS action TEXT NOT NULL;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS details JSONB;

-- 15. Exchanges Table
CREATE TABLE IF NOT EXISTS public.exchanges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL CHECK (from_currency IN ('BDT', 'RMB')),
  to_currency TEXT NOT NULL CHECK (to_currency IN ('BDT', 'RMB')),
  amount_from_cents BIGINT NOT NULL,
  amount_to_cents BIGINT NOT NULL,
  rate DECIMAL NOT NULL
);

-- 16. Partner Transfers Table
CREATE TABLE IF NOT EXISTS public.partner_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  to_partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('BDT', 'RMB')),
  method TEXT DEFAULT 'cash',
  notes TEXT
);

-- SECURITY HELPERS

-- 1. Identity Check Helper
CREATE OR REPLACE FUNCTION public.user_can_access_business(p_business_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM businesses WHERE id = p_business_id AND owner_id = auth.uid()
    UNION
    SELECT 1 FROM profiles WHERE id = auth.uid() AND business_id = p_business_id
    UNION
    SELECT 1 FROM business_members WHERE business_id = p_business_id AND user_id = auth.uid()
  );
END;
$$;

-- 2. Auth Trigger for Automatic Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, email, phone)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'name', '')), 
    COALESCE(new.raw_user_meta_data->>'username', ''),
    new.email,
    new.phone
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS balance_cents BIGINT DEFAULT 0;

-- Track specific distribution events for audit trail
DROP TABLE IF EXISTS public.partner_profit_distributions CASCADE;
CREATE TABLE IF NOT EXISTS public.partner_profit_distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  ledger_id UUID REFERENCES public.customer_ledger(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  notes TEXT
);

ALTER TABLE public.partner_profit_distributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_access_partner_profit_distributions ON public.partner_profit_distributions;

-- Add tracking for already distributed profit on sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS distributed_profit_cents BIGINT DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_partner_balance(p_id UUID, amount_cents BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.partners
  SET balance_cents = balance_cents + amount_cents
  WHERE id = p_id;
END;
$$;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- SPECIFIC POLICIES
DROP POLICY IF EXISTS "Users can create businesses" ON public.businesses;
CREATE POLICY "Users can create businesses" ON public.businesses FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update their business" ON public.businesses;
CREATE POLICY "Owners can update their business" ON public.businesses FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners and members can view their business" ON public.businesses;
CREATE POLICY "Owners and members can view their business" ON public.businesses FOR SELECT 
USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.business_members WHERE business_id = public.businesses.id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
CREATE POLICY "Users can view any profile" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 18. Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  wechat TEXT,
  location TEXT,
  shop_name TEXT,
  shop_link TEXT,
  products_list TEXT,
  notes TEXT
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- MULTI-TENANT DATA ACCESS
DO $$ 
DECLARE 
  t text;
  tables text[] := ARRAY['partners', 'capital_contributions', 'customers', 'inventory_items', 'purchase_transactions', 'sales', 'customer_ledger', 'expenses', 'business_members', 'join_requests', 'activity_log', 'exchanges', 'partner_transfers', 'partner_profit_distributions', 'suppliers'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE 'DROP POLICY IF EXISTS data_access_' || t || ' ON public.' || t;
    
    -- Only create policy if business_id column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'business_id'
    ) THEN
      EXECUTE 'CREATE POLICY data_access_' || t || ' ON public.' || t || ' FOR ALL USING (public.user_can_access_business(business_id)) WITH CHECK (public.user_can_access_business(business_id))';
    END IF;
  END LOOP;
END $$;

-- NOTIFICATIONS (User specific)
DROP POLICY IF EXISTS "data_access_notifications" ON public.notifications;
CREATE POLICY "data_access_notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- VALUATION RPC
CREATE OR REPLACE FUNCTION public.get_business_valuation(p_business_id UUID)
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_bdt BIGINT;
  v_inventory_value BIGINT;
  v_receivables BIGINT;
  v_payables BIGINT;
  v_rate DECIMAL;
BEGIN
  -- Get exchange rate with fallback
  v_rate := 18.0;
  SELECT COALESCE(exchange_rate, 18.0) INTO v_rate FROM businesses WHERE id = p_business_id;
  v_rate := COALESCE(v_rate, 18.0);

  -- Cash calculation incorporating Sales, Payments, Expenses, Purchases and Capital Contributions
  -- 1. Initial cash from sales (received now)
  SELECT COALESCE(SUM(received_now_bdt_cents), 0) INTO v_cash_bdt 
  FROM sales 
  WHERE business_id = p_business_id;
  
  -- 2. Add payments from customers
  v_cash_bdt := v_cash_bdt + COALESCE((SELECT SUM(amount_cents) FROM customer_ledger WHERE business_id = p_business_id AND transaction_type = 'payment'), 0);
  
  -- 3. Add capital contributions
  v_cash_bdt := v_cash_bdt + COALESCE((SELECT SUM(CAST(amount * 100 AS BIGINT)) FROM capital_contributions WHERE business_id = p_business_id AND currency = 'BDT'), 0);
  v_cash_bdt := v_cash_bdt + COALESCE((SELECT SUM(CAST(amount * 100 * v_rate AS BIGINT)) FROM capital_contributions WHERE business_id = p_business_id AND currency = 'RMB'), 0);
  
  -- 4. Subtract purchases (only paid ones)
  v_cash_bdt := v_cash_bdt - COALESCE((SELECT SUM(total_landed_cost_bdt_cents) FROM purchase_transactions WHERE business_id = p_business_id AND paid = true), 0);
  
  -- 5. Subtract expenses
  v_cash_bdt := v_cash_bdt - COALESCE((SELECT SUM(amount_cents) FROM expenses WHERE business_id = p_business_id AND currency = 'BDT'), 0);
  v_cash_bdt := v_cash_bdt - COALESCE((SELECT SUM(CAST(amount_cents * v_rate AS BIGINT)) FROM expenses WHERE business_id = p_business_id AND currency = 'RMB'), 0);

  -- Inventory Valuation: Stock * Landed Cost (prefer latest transaction cost, fallback to item record)
  SELECT COALESCE(SUM(current_stock * COALESCE(pt.landed_cost_per_unit_bdt_cents, i.last_landed_cost_cents, 0)), 0)
  INTO v_inventory_value
  FROM inventory_items i
  LEFT JOIN (
    SELECT DISTINCT ON (item_id) item_id, landed_cost_per_unit_bdt_cents
    FROM purchase_transactions
    ORDER BY item_id, created_at DESC
  ) pt ON pt.item_id = i.id
  WHERE i.business_id = p_business_id;

  -- Receivables calculation: Sales Dues - Payments - Returns
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type = 'sale' THEN amount_cents 
      WHEN transaction_type = 'payment' THEN -amount_cents 
      WHEN transaction_type = 'return' THEN -amount_cents 
      ELSE 0 
    END
  ), 0) INTO v_receivables 
  FROM customer_ledger 
  WHERE business_id = p_business_id;

  -- Payables: Total of unpaid purchase transactions
  SELECT COALESCE(SUM(total_landed_cost_bdt_cents), 0) INTO v_payables FROM purchase_transactions WHERE business_id = p_business_id AND paid = false;

  RETURN json_build_object(
    'cash_bdt', COALESCE(v_cash_bdt, 0),
    'inventory_value', COALESCE(v_inventory_value, 0),
    'receivables', COALESCE(v_receivables, 0),
    'payables', COALESCE(v_payables, 0),
    'total_assets', COALESCE(v_cash_bdt, 0) + COALESCE(v_inventory_value, 0) + COALESCE(v_receivables, 0),
    'business_value', (COALESCE(v_cash_bdt, 0) + COALESCE(v_inventory_value, 0) + COALESCE(v_receivables, 0)) - COALESCE(v_payables, 0)
  );
END;
$$;

-- 17. Inventory Management RPCs
CREATE OR REPLACE FUNCTION public.decrement_inventory_stock(item_id UUID, amount INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inventory_items
  SET current_stock = current_stock - amount
  WHERE id = item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_inventory_stock(item_id UUID, amount INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inventory_items
  SET current_stock = current_stock + amount
  WHERE id = item_id;
END;
$$;
