// 1Commerce API Client — shared HTTP utilities

import { API_BASE_URL, API_KEY, CHARACTER_LIMIT } from "../constants.js";
import type { ApiResponse, ApiError } from "../types.js";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

export class OneCommerceClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
    this.apiKey = apiKey || API_KEY;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = "GET", body, params, headers = {} } = options;

    const url = new URL(`${this.baseUrl}/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...headers,
    };

    if (this.apiKey) {
      requestHeaders["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url.toString(), fetchOptions);

      if (!response.ok) {
        const errorBody = await response.text();
        let apiError: ApiError;
        try {
          apiError = JSON.parse(errorBody) as ApiError;
        } catch {
          apiError = {
            code: `HTTP_${response.status}`,
            message: `Request failed with status ${response.status}: ${errorBody.slice(0, 200)}`,
          };
        }
        throw new OneCommerceApiError(response.status, apiError);
      }

      return (await response.json()) as ApiResponse<T>;
    } catch (error: unknown) {
      if (error instanceof OneCommerceApiError) throw error;

      const message = error instanceof Error ? error.message : "Unknown network error";
      throw new OneCommerceApiError(0, {
        code: "NETWORK_ERROR",
        message: `Failed to connect to 1Commerce API: ${message}. Verify ONECOMMERCE_API_URL and ONECOMMERCE_API_KEY environment variables are set.`,
      });
    }
  }
}

export class OneCommerceApiError extends Error {
  public status: number;
  public code: string;
  public details?: Record<string, unknown>;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "OneCommerceApiError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }

  toToolResult(): { content: Array<{ type: "text"; text: string }> } {
    const hint = this.getRecoveryHint();
    return {
      content: [{
        type: "text" as const,
        text: `Error [${this.code}]: ${this.message}${hint ? `\n\nSuggestion: ${hint}` : ""}`,
      }],
    };
  }

  private getRecoveryHint(): string | null {
    switch (this.status) {
      case 401:
        return "Check that ONECOMMERCE_API_KEY is set and valid.";
      case 403:
        return "The API key does not have permission for this operation. Verify tenant access.";
      case 404:
        return "The requested resource was not found. Check the ID and try listing available resources first.";
      case 409:
        return "Conflict — the resource may have been modified. Fetch the latest version and retry.";
      case 429:
        return "Rate limit exceeded. Wait a moment and retry.";
      default:
        return null;
    }
  }
}

export function truncateResponse(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  const truncated = text.slice(0, CHARACTER_LIMIT);
  return `${truncated}\n\n... [Response truncated at ${CHARACTER_LIMIT} characters. Use pagination or filters to retrieve the remaining data.]`;
}

// Singleton client instance
let clientInstance: OneCommerceClient | null = null;

export function getClient(): OneCommerceClient {
  if (!clientInstance) {
    clientInstance = new OneCommerceClient();
  }
  return clientInstance;
}
