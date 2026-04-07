// 1Commerce / UnifyOne MCP Server Constants

export const API_BASE_URL = process.env.ONECOMMERCE_API_URL || "https://api.1commerce.online/v1";
export const API_KEY = process.env.ONECOMMERCE_API_KEY || "";
export const CHARACTER_LIMIT = 50_000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const SUPPORTED_PLATFORMS = [
  "shopify",
  "ebay",
  "amazon",
  "doordash",
  "uber_eats",
  "instacart",
  "grubhub",
] as const;

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const AUTOMATION_TRIGGER_TYPES = [
  "order_created",
  "order_fulfilled",
  "inventory_low",
  "customer_created",
  "payment_received",
  "shift_completed",
  "route_optimized",
  "challenge_unlocked",
] as const;
