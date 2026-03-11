import { beforeEach, describe, expect, it } from 'vitest';
import { PipelineConfigService, POLICY_ID } from './PipelineConfigService.js';

interface MockStatement {
  get(id: string): { id: string } | { actions: string } | undefined;
  run(...args: string[]): void;
}

interface MockDb {
  prepare(sql: string): MockStatement;
}

describe('PipelineConfigService', () => {
  let db: MockDb;
  let actionsJson = '';

  beforeEach(() => {
    actionsJson = '';
    db = {
      prepare: (sql: string) => ({
        get: (id: string) => {
          if (sql.includes('SELECT id FROM mc_policies')) {
            return actionsJson && id === POLICY_ID ? { id } : undefined;
          }
          if (sql.includes('SELECT actions FROM mc_policies')) {
            return actionsJson && id === POLICY_ID ? { actions: actionsJson } : undefined;
          }
          return undefined;
        },
        run: (...args: string[]) => {
          if (sql.includes('INSERT INTO mc_policies')) {
            actionsJson = args[2];
            return;
          }
          if (sql.includes('UPDATE mc_policies SET actions = ?')) {
            actionsJson = args[0];
          }
        },
      }),
    };
  });

  it('includes humanizer defaults in the stored config', () => {
    const service = new PipelineConfigService(db);

    const config = service.getConfig();

    expect(config.humanizer).toEqual({
      enabled: false,
      mode: 'light',
      traceEnabled: true,
    });
  });

  it('deep merges older stored configs that do not include humanizer fields', () => {
    const service = new PipelineConfigService(db);
    db.prepare('UPDATE mc_policies SET actions = ? WHERE id = ?').run(JSON.stringify({
      directResponse: {
        enabled: true,
      },
      fallbackMessage: 'Bizi arayin.',
    }), POLICY_ID);

    const config = service.getConfig();

    expect(config.fallbackMessage).toBe('Bizi arayin.');
    expect(config.humanizer.enabled).toBe(false);
    expect(config.humanizer.mode).toBe('light');
    expect(config.directResponse.tiers.light.modelId).toBeTruthy();
  });
});
