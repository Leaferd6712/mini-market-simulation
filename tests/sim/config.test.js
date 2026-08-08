import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('isLeaderboardConfigured', () => {
  const original = import.meta.env.VITE_LB_API_BASE;

  afterEach(() => {
    vi.resetModules();
    if (original === undefined) delete import.meta.env.VITE_LB_API_BASE;
    else import.meta.env.VITE_LB_API_BASE = original;
  });

  it('is false when VITE_LB_API_BASE is empty', async () => {
    import.meta.env.VITE_LB_API_BASE = '';
    vi.resetModules();
    const { isLeaderboardConfigured } = await import('../../src/config.js');
    expect(isLeaderboardConfigured()).toBe(false);
  });

  it('is true for http localhost API', async () => {
    import.meta.env.VITE_LB_API_BASE = 'http://localhost:8788';
    vi.resetModules();
    const { isLeaderboardConfigured, LB_API_BASE } = await import('../../src/config.js');
    expect(isLeaderboardConfigured()).toBe(true);
    expect(LB_API_BASE).toBe('http://localhost:8788');
  });

  it('strips trailing slash', async () => {
    import.meta.env.VITE_LB_API_BASE = 'https://example.trycloudflare.com/';
    vi.resetModules();
    const { LB_API_BASE } = await import('../../src/config.js');
    expect(LB_API_BASE).toBe('https://example.trycloudflare.com');
  });
});
