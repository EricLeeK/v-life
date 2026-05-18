-- Shop System: shop_items, user_inventory, gacha_pity tables
-- Extends user_points with privilege coupon fields

-- ============ shop_items ============

CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('cosmetic_profile', 'cosmetic_title', 'privilege_coupon')),
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'legendary')),
  price INTEGER,
  image_url TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_items_rarity ON public.shop_items (rarity);
CREATE INDEX IF NOT EXISTS idx_shop_items_type ON public.shop_items (item_type);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_items_select_all" ON public.shop_items
  FOR SELECT USING (true);

-- ============ user_inventory ============

CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  item_id UUID REFERENCES public.shop_items(id) ON DELETE CASCADE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('shop_purchase', 'gacha_pull', 'milestone_unlock')),
  is_equipped BOOLEAN DEFAULT false,
  is_used BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON public.user_inventory (user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_item_id ON public.user_inventory (item_id);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_inventory_select_own" ON public.user_inventory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_inventory_insert_own" ON public.user_inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_inventory_update_own" ON public.user_inventory
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_inventory_delete_own" ON public.user_inventory
  FOR DELETE USING (auth.uid() = user_id);

-- ============ gacha_pity ============

CREATE TABLE IF NOT EXISTS public.gacha_pity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users NOT NULL,
  pulls_since_legendary INTEGER DEFAULT 0,
  total_pulls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_pity_user_id ON public.gacha_pity (user_id);

CREATE TRIGGER update_gacha_pity_updated_at
  BEFORE UPDATE ON public.gacha_pity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.gacha_pity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gacha_pity_select_own" ON public.gacha_pity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "gacha_pity_insert_own" ON public.gacha_pity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gacha_pity_update_own" ON public.gacha_pity
  FOR UPDATE USING (auth.uid() = user_id);

-- ============ Extend user_points with privilege fields ============

ALTER TABLE public.user_points
  ADD COLUMN IF NOT EXISTS rest_day_date DATE,
  ADD COLUMN IF NOT EXISTS skip_chore_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sleep_in_date DATE;
