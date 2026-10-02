import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../api/client';

describe('PADUPOS Web ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('injects authorization bearer token, business id, and branch id headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock;

    const client = new ApiClient({
      baseUrl: 'http://localhost:4000/api/v1',
      getAuthToken: () => 'test_token_123',
      getBusinessId: () => 'biz_test_456',
      getBranchId: () => 'brn_test_789',
    });

    const res = await client.get('/test-endpoint');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe('http://localhost:4000/api/v1/test-endpoint');
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test_token_123',
      'x-business-id': 'biz_test_456',
      'x-branch-id': 'brn_test_789',
    });
    expect(res.data).toEqual({ success: true });
  });

  it('triggers onUnauthorized callback on 401 response', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: { code: 'UNAUTHORIZED', message: 'Token expired' },
      }),
    });
    global.fetch = fetchMock;

    const client = new ApiClient({
      baseUrl: 'http://localhost:4000/api/v1',
      onUnauthorized,
    });

    const res = await client.get('/protected');

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(res.error?.code).toBe('UNAUTHORIZED');
  });

  it('handles network errors gracefully without crashing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const client = new ApiClient({
      baseUrl: 'http://localhost:4000/api/v1',
    });

    const res = await client.get('/health');

    expect(res.data).toBeUndefined();
    expect(res.error).toEqual({
      code: 'NETWORK_ERROR',
      message: 'Connection refused',
    });
  });

  it('supports idempotency keys on mutating POST requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ saleId: 'sale_1' }),
    });
    global.fetch = fetchMock;

    const client = new ApiClient({
      baseUrl: 'http://localhost:4000/api/v1',
    });

    await client.post(
      '/pos/sales',
      { items: [] },
      { idempotencyKey: 'idem_unique_key_001' }
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['idempotency-key']).toBe('idem_unique_key_001');
  });
});
