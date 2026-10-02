// PADUPOS Typed API Client
// Handles multi-tenant headers, auth token injection, idempotency, and structured error responses.

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
  details?: Array<{ field?: string; message: string }>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | null;
  getBusinessId?: () => string | null;
  getBranchId?: () => string | null;
  onUnauthorized?: () => void;
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  setConfig(partial: Partial<ApiClientConfig>) {
    this.config = { ...this.config, ...partial };
  }

  async request<T>(
    endpoint: string,
    options: RequestInit & { idempotencyKey?: string } = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = this.config.getAuthToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const businessId = this.config.getBusinessId?.();
    if (businessId) {
      headers['x-business-id'] = businessId;
    }

    const branchId = this.config.getBranchId?.();
    if (branchId) {
      headers['x-branch-id'] = branchId;
    }

    if (options.idempotencyKey) {
      headers['idempotency-key'] = options.idempotencyKey;
    }

    try {
      const url = `${this.config.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      const res = await fetch(url, {
        ...options,
        headers,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401 && this.config.onUnauthorized) {
          this.config.onUnauthorized();
        }

        return {
          error: json?.error || {
            code: `HTTP_${res.status}`,
            message: res.statusText || 'An unexpected server error occurred',
          },
        };
      }

      return { data: json as T };
    } catch (err: any) {
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Failed to connect to PADUPOS server',
        },
      };
    }
  }

  get<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestInit & { idempotencyKey?: string }) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Global API Client Instance
const getClientToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('padupos_auth_token');
};

const getClientBusinessId = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('padupos_business_id');
};

const getClientBranchId = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('padupos_branch_id');
};

export const api = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  getAuthToken: getClientToken,
  getBusinessId: getClientBusinessId,
  getBranchId: getClientBranchId,
});
