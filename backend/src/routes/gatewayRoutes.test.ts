import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createGatewayRoutes, setGatewayCliRunner } from './gatewayRoutes.js';

describe('Gateway Routes', () => {
  let app: express.Application;
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    setGatewayCliRunner(null);
    db.close();
  });

  it('returns an OpenClaw ops summary with parsed CLI data', async () => {
    setGatewayCliRunner(async (args) => {
      const key = args.join(' ');

      if (key === '--version') {
        return {
          ok: true,
          stdout: 'OpenClaw 2026.3.8 (3caab92)\n',
          stderr: '',
          exitCode: 0,
          error: null,
          command: 'openclaw',
          args,
        };
      }

      if (key === 'gateway status --json --timeout 3000') {
        return {
          ok: true,
          stdout: JSON.stringify({
            service: {
              runtime: { status: 'running', detail: 'ok' },
              configAudit: { ok: true, issues: [] },
            },
            rpc: { ok: true },
          }),
          stderr: '',
          exitCode: 0,
          error: null,
          command: 'openclaw',
          args,
        };
      }

      if (key === 'gateway health --json --timeout 3000') {
        return {
          ok: true,
          stdout: JSON.stringify({ ok: true, latencyMs: 42 }),
          stderr: '',
          exitCode: 0,
          error: null,
          command: 'openclaw',
          args,
        };
      }

      if (key === 'security audit --json') {
        return {
          ok: true,
          stdout: JSON.stringify({
            summary: { critical: 0, warn: 1, info: 0 },
            findings: [
              {
                checkId: 'gateway.trusted_proxies_missing',
                severity: 'warn',
                title: 'Reverse proxy headers are not trusted',
              },
            ],
          }),
          stderr: '',
          exitCode: 0,
          error: null,
          command: 'openclaw',
          args,
        };
      }

      return {
        ok: false,
        stdout: '',
        stderr: 'unexpected command',
        exitCode: 1,
        error: 'unexpected command',
        command: 'openclaw',
        args,
      };
    });

    app.use('/api/mc/gateways', createGatewayRoutes(db));

    const response = await request(app).get('/api/mc/gateways/ops/summary');

    expect(response.status).toBe(200);
    expect(response.body.cli.version).toBe('OpenClaw 2026.3.8 (3caab92)');
    expect(response.body.summary.runtimeStatus).toBe('running');
    expect(response.body.summary.rpcOk).toBe(true);
    expect(response.body.summary.securityCounts.warn).toBe(1);
    expect(response.body.gatewayHealth.ok).toBe(true);
    expect(response.body.activeGateway).toMatchObject({
      name: 'Yerel Gateway',
      is_active: 1,
    });
    expect(response.body.activeGateway.token).toBeUndefined();
  });

  it('returns a structured gatewayHealth error when the health probe fails', async () => {
    setGatewayCliRunner(async (args) => {
      const key = args.join(' ');

      if (key === '--version') {
        return {
          ok: true,
          stdout: 'OpenClaw 2026.3.8 (3caab92)\n',
          stderr: '',
          exitCode: 0,
          error: null,
          command: 'openclaw',
          args,
        };
      }

      if (key === 'gateway status --json --timeout 3000') {
        return {
          ok: true,
          stdout: JSON.stringify({
            service: {
              runtime: { status: 'stopped', detail: 'offline' },
              configAudit: { ok: false, issues: [{ code: 'gateway-token-embedded' }] },
            },
            rpc: { ok: false },
          }),
          stderr: '',
          exitCode: 0,
          error: null,
          command: 'openclaw',
          args,
        };
      }

      if (key === 'gateway health --json --timeout 3000') {
        return {
          ok: false,
          stdout: '',
          stderr: 'gateway closed',
          exitCode: 1,
          error: 'gateway closed',
          command: 'openclaw',
          args,
        };
      }

      if (key === 'security audit --json') {
        return {
          ok: true,
          stdout: JSON.stringify({ summary: { critical: 0, warn: 0, info: 0 }, findings: [] }),
          stderr: '',
          exitCode: 0,
          error: null,
          command: 'openclaw',
          args,
        };
      }

      return {
        ok: false,
        stdout: '',
        stderr: 'unexpected command',
        exitCode: 1,
        error: 'unexpected command',
        command: 'openclaw',
        args,
      };
    });

    app.use('/api/mc/gateways', createGatewayRoutes(db));

    const response = await request(app).get('/api/mc/gateways/ops/summary');

    expect(response.status).toBe(200);
    expect(response.body.gatewayHealth.ok).toBe(false);
    expect(response.body.gatewayHealth.error).toContain('gateway closed');
    expect(response.body.summary.runtimeStatus).toBe('stopped');
    expect(response.body.summary.configAuditIssues).toHaveLength(1);
  });
});
