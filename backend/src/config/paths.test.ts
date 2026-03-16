import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveFrontendRuntimeDir } from './paths.js';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kio-paths-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const tempRoot = tempRoots.pop();
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
});

describe('resolveFrontendRuntimeDir', () => {
  it('prefers backend/public when an index exists there', () => {
    const root = makeTempRoot();
    const backendPublic = path.join(root, 'backend', 'public');
    const frontendDist = path.join(root, 'frontend', 'dist');

    fs.mkdirSync(backendPublic, { recursive: true });
    fs.mkdirSync(frontendDist, { recursive: true });
    fs.writeFileSync(path.join(backendPublic, 'index.html'), 'backend');
    fs.writeFileSync(path.join(frontendDist, 'index.html'), 'frontend');

    expect(resolveFrontendRuntimeDir(root)).toBe(backendPublic);
  });

  it('falls back to frontend/dist when backend/public is missing', () => {
    const root = makeTempRoot();
    const frontendDist = path.join(root, 'frontend', 'dist');

    fs.mkdirSync(frontendDist, { recursive: true });
    fs.writeFileSync(path.join(frontendDist, 'index.html'), 'frontend');

    expect(resolveFrontendRuntimeDir(root)).toBe(frontendDist);
  });
});
