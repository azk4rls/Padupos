import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthContext, type AuthContextType } from '@/context/AuthContext';
import { testBusiness, testBranch, testBranchTwo } from './fixtures';

export function makeAuthContext(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: { id: 'usr_test_001', email: 'owner@padupos.test' },
    token: 'token_test',
    businesses: [testBusiness],
    activeBusiness: testBusiness,
    branches: [testBranch, testBranchTwo],
    activeBranch: null,
    status: 'authenticated',
    login: vi.fn().mockResolvedValue(true),
    logout: vi.fn(),
    setActiveBusiness: vi.fn(),
    setActiveBranch: vi.fn(),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function renderWithAuth(
  ui: React.ReactElement,
  authOverrides: Partial<AuthContextType> = {}
): RenderResult {
  return render(
    <AuthContext.Provider value={makeAuthContext(authOverrides)}>{ui}</AuthContext.Provider>
  );
}

type RouteHandler = (url: string, init?: RequestInit) => unknown;

/**
 * Installs a fetch stub that resolves the given real backend route shapes.
 * Any request outside `routes` returns an explicit 404 so a test fails loudly
 * if the page starts calling an endpoint the backend does not implement.
 */
export function mockApiRoutes(routes: Record<string, RouteHandler>) {
  const seen: string[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push(url);

    const path = url.replace(/^https?:\/\/[^/]+\/api\/v1/, '');
    const [pathname] = path.split('?');
    const handler = routes[pathname];

    if (!handler) {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { code: 'NOT_FOUND', message: `No stub for ${pathname}` } }),
      } as unknown as Response;
    }

    const payload = handler(url, init);
    if (payload instanceof Error) {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: { code: 'INTERNAL', message: payload.message } }),
      } as unknown as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => payload,
    } as unknown as Response;
  });

  global.fetch = fetchMock as unknown as typeof fetch;

  return { fetchMock, seen };
}

/** Helper to build an error payload for the fetch stub. */
export function apiError(message: string): Error {
  return new Error(message);
}