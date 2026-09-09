import { describe, it, expect, vi } from 'vitest';
import { client, isTursoConfigured, initTursoDB } from './src/lib/turso';

vi.mock('./src/lib/turso', () => ({
  client: { execute: vi.fn() },
  isTursoConfigured: true,
  initTursoDB: vi.fn(),
}));

describe('test', () => {
  it('test', () => {
    console.log("client:", client);
    console.log("isTursoConfigured:", isTursoConfigured);
    console.log("initTursoDB:", initTursoDB);
    expect(initTursoDB).toBeDefined();
  });
});
