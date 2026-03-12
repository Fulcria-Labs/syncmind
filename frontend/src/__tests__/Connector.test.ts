import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock uuid before importing Connector
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234'
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock window.dispatchEvent for conflict handling
if (typeof window === 'undefined') {
  (globalThis as any).window = { dispatchEvent: vi.fn() };
} else {
  vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
}

// Mock import.meta.env
(globalThis as any).__import_meta_env = {};

import { SyncMindConnector } from '../lib/Connector';

describe('SyncMindConnector', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('generates a new user ID if none exists', () => {
    localStorageMock.getItem.mockReturnValueOnce(null);
    const connector = new SyncMindConnector();
    expect(connector.userId).toBe('test-uuid-1234');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('syncmind_user_id', 'test-uuid-1234');
  });

  it('reuses existing user ID from localStorage', () => {
    localStorageMock.getItem.mockReturnValueOnce('existing-id-5678');
    const connector = new SyncMindConnector();
    expect(connector.userId).toBe('existing-id-5678');
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('fetchCredentials calls the auth endpoint', async () => {
    const mockResponse = { token: 'jwt-token-123' };
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    localStorageMock.getItem.mockReturnValueOnce('user-abc');
    const connector = new SyncMindConnector();
    const creds = await connector.fetchCredentials();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/token?user_id=user-abc')
    );
    expect(creds.token).toBe('jwt-token-123');
    expect(creds.endpoint).toBeDefined();
  });

  it('fetchCredentials throws on auth failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    localStorageMock.getItem.mockReturnValueOnce('user-abc');
    const connector = new SyncMindConnector();
    await expect(connector.fetchCredentials()).rejects.toThrow('Auth failed: 401');
  });

  it('uploadData handles empty transaction gracefully', async () => {
    localStorageMock.getItem.mockReturnValueOnce('user-abc');
    const connector = new SyncMindConnector();

    const mockDb = {
      getNextCrudTransaction: vi.fn().mockResolvedValueOnce(null),
    };

    // Should complete without error
    await connector.uploadData(mockDb as any);
    expect(mockDb.getNextCrudTransaction).toHaveBeenCalled();
  });

  it('uploadData sends batch to backend', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    localStorageMock.getItem.mockReturnValueOnce('user-abc');
    const connector = new SyncMindConnector();

    const mockTransaction = {
      crud: [
        { op: 'PUT', table: 'notes', id: 'note-1', opData: { title: 'Test' } },
      ],
      complete: vi.fn(),
    };

    const mockDb = {
      getNextCrudTransaction: vi.fn().mockResolvedValueOnce(mockTransaction),
    };

    await connector.uploadData(mockDb as any);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/data'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(mockTransaction.complete).toHaveBeenCalled();
  });

  it('uploadData handles 409 conflict with last-write-wins', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ message: 'Conflict' }),
    });

    localStorageMock.getItem.mockReturnValueOnce('user-abc');
    const connector = new SyncMindConnector();

    const mockTransaction = {
      crud: [
        { op: 'PUT', table: 'notes', id: 'note-1', opData: { title: 'Test' } },
      ],
      complete: vi.fn(),
    };

    const mockDb = {
      getNextCrudTransaction: vi.fn().mockResolvedValueOnce(mockTransaction),
    };

    await connector.uploadData(mockDb as any);
    // Should complete transaction despite conflict (last-write-wins)
    expect(mockTransaction.complete).toHaveBeenCalled();
  });

  it('uploadData throws on non-conflict errors', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    });

    localStorageMock.getItem.mockReturnValueOnce('user-abc');
    const connector = new SyncMindConnector();

    const mockTransaction = {
      crud: [
        { op: 'PUT', table: 'notes', id: 'note-1', opData: { title: 'Test' } },
      ],
      complete: vi.fn(),
    };

    const mockDb = {
      getNextCrudTransaction: vi.fn().mockResolvedValueOnce(mockTransaction),
    };

    await expect(connector.uploadData(mockDb as any)).rejects.toThrow('Upload failed: 500');
    expect(mockTransaction.complete).not.toHaveBeenCalled();
  });
});
