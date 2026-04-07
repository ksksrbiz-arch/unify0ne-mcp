// 1Commerce / UnifyOne Type Definitions

export interface Store {
  id: string;
  name: string;
  slug: string;
  platform: string;
  status: "active" | "paused" | "onboarding";
  tenant_id: string;
  created_at: string;
  updated_at: string;
  settings: StoreSettings;
}

export interface StoreSettings {
  currency: string;
  timezone: string;
  tax_enabled: boolean;
  auto_fulfill: boolean;
  inventory_sync: boolean;
}

export interface Product {
  id: string;
  store_id: string;
  title: string;
  sku: string;
  price: number;
  compare_at_price: number | null;
  inventory_quantity: number;
  inventory_threshold: number;
  status: "active" | "draft" | "archived";
  platform_ids: Record<string, string>;
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  sku: string;
  price: number;
  inventory_quantity: number;
}

export interface Order {
  id: string;
  store_id: string;
  order_number: string;
  status: string;
  platform: string;
  customer: Customer;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  created_at: string;
  fulfilled_at: string | null;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface LineItem {
  product_id: string;
  variant_id: string | null;
  title: string;
  quantity: number;
  price: number;
}

export interface ManusInsight {
  type: "route" | "earnings" | "challenge" | "tax" | "trend";
  title: string;
  summary: string;
  confidence: number;
  data: Record<string, unknown>;
  generated_at: string;
}

export interface EarningsProjection {
  period: string;
  projected_gross: number;
  projected_net: number;
  projected_tax: number;
  platform_breakdown: Record<string, number>;
  confidence: number;
}

export interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  actions: AutomationAction[];
  status: "active" | "paused" | "draft";
  last_triggered_at: string | null;
  execution_count: number;
  created_at: string;
}

export interface AutomationAction {
  type: string;
  config: Record<string, unknown>;
  order: number;
}

export interface Tenant {
  id: string;
  name: string;
  owner_email: string;
  plan: "starter" | "professional" | "enterprise";
  stores: string[];
  isolation_level: "schema" | "database";
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    per_page: number;
    has_more: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
