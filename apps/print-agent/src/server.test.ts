import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAgentServer } from './server';

describe('print agent server', () => {
  const server = createAgentServer();
  let base = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
  });

  it('answers /health', async () => {
    const res = await fetch(`${base}/health`);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('404s unknown paths', async () => {
    expect((await fetch(`${base}/nope`)).status).toBe(404);
  });
});
