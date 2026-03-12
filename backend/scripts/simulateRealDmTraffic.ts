import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { InstagramContextService } from '../src/services/InstagramContextService.js';
import { DMKnowledgeContextService } from '../src/services/DMKnowledgeContextService.js';
import {
  buildDeterministicClarifierResponse,
  buildDeterministicCloseoutResponse,
  isDirectLocationQuestion,
  isDirectPhoneQuestion,
  isGenericInfoRequest,
} from '../src/services/DMPipelineHeuristics.js';
import { evaluateSexualIntent } from '../src/middleware/sexualIntentFilter.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultReplayDbPath = path.resolve(scriptDir, '..', '..', 'data', 'kiosk.db');

type ReplayRow = {
  instagram_id: string;
  message_text: string;
  created_at: string;
};

type ReplayResult = {
  senderId: string;
  createdAt: string;
  messageText: string;
  safetyAction: string;
  safetyModel: string;
  simpleTurnUsed: boolean;
  fastLane:
    | 'none'
    | 'deterministic_info_template'
    | 'deterministic_contact_location'
    | 'deterministic_contact_phone'
    | 'deterministic_hours'
    | 'deterministic_closeout'
    | 'deterministic_no_reply'
    | 'deterministic_clarifier';
  responseMode: string;
  intentCategories: string[];
  matchedKeywords: string[];
  wouldNeedAIGeneration: boolean;
  responsePreview: string | null;
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(token, 'true');
      continue;
    }
    args.set(token, next);
    i += 1;
  }

  return {
    dbPath: args.get('--db') || defaultReplayDbPath,
    limit: Number(args.get('--limit') || 20),
    senderId: args.get('--sender') || null,
    sinceDays: Number(args.get('--days') || 30),
  };
}

function getRecentRealInboundRows(db: Database.Database, options: { limit: number; senderId: string | null; sinceDays: number }): ReplayRow[] {
  if (options.senderId) {
    return db.prepare(`
      SELECT instagram_id, message_text, created_at
      FROM instagram_interactions
      WHERE direction = 'inbound'
        AND instagram_id = ?
        AND message_text IS NOT NULL
        AND TRIM(message_text) <> ''
      ORDER BY created_at DESC
      LIMIT ?
    `).all(options.senderId, options.limit) as ReplayRow[];
  }

  return db.prepare(`
    SELECT instagram_id, message_text, created_at
    FROM instagram_interactions
    WHERE direction = 'inbound'
      AND created_at >= datetime('now', ?)
      AND instagram_id NOT LIKE 'sim_%'
      AND instagram_id NOT LIKE 'test_%'
      AND instagram_id NOT LIKE 'workflow_%'
      AND instagram_id NOT LIKE 'ig-real-traffic%'
      AND message_text IS NOT NULL
      AND TRIM(message_text) <> ''
    ORDER BY created_at DESC
    LIMIT ?
  `).all(`-${options.sinceDays} days`, options.limit) as ReplayRow[];
}

function resolveFastLane(params: {
  messageText: string;
  matchedKeywords: string[];
  intentCategories: string[];
  responseMode: string;
  templates: ReturnType<DMKnowledgeContextService['getDeterministicTemplates']>;
}): { kind: ReplayResult['fastLane']; responsePreview: string | null } {
  const { messageText, matchedKeywords, intentCategories, responseMode, templates } = params;

  if (templates.genericInfo && isGenericInfoRequest(messageText)) {
    return {
      kind: 'deterministic_info_template',
      responsePreview: templates.genericInfo,
    };
  }

  if (templates.contactLocation && isDirectLocationQuestion(messageText)) {
    return {
      kind: 'deterministic_contact_location',
      responsePreview: templates.contactLocation,
    };
  }

  if (templates.contactPhone && isDirectPhoneQuestion(messageText)) {
    return {
      kind: 'deterministic_contact_phone',
      responsePreview: templates.contactPhone,
    };
  }

  if (templates.generalHours && matchedKeywords.includes('standalone_hours_request')) {
    return {
      kind: 'deterministic_hours',
      responsePreview: templates.generalHours,
    };
  }

  const closeout = buildDeterministicCloseoutResponse(messageText);
  if (closeout) {
    return {
      kind: closeout.action === 'skip_send' ? 'deterministic_no_reply' : 'deterministic_closeout',
      responsePreview: closeout.response,
    };
  }

  const clarifier = buildDeterministicClarifierResponse({
    messageText,
    intentCategories,
    responseMode: responseMode as any,
    semanticSignals: matchedKeywords,
  });
  if (clarifier) {
    return {
      kind: 'deterministic_clarifier',
      responsePreview: clarifier.response,
    };
  }

  return {
    kind: 'none',
    responsePreview: null,
  };
}

async function analyzeRow(
  row: ReplayRow,
  contextService: InstagramContextService,
  knowledgeContextService: DMKnowledgeContextService,
): Promise<ReplayResult> {
  const safety = await evaluateSexualIntent(row.message_text);
  const simpleAnalysis = contextService.analyzeSimpleTurn(row.instagram_id, row.message_text);
  const analysis = simpleAnalysis || await contextService.analyzeMessage(row.instagram_id, row.message_text);
  const fastLane = safety.action === 'allow'
    ? resolveFastLane({
        messageText: row.message_text,
        matchedKeywords: analysis.matchedKeywords,
        intentCategories: analysis.intentCategories,
        responseMode: analysis.responseDirective.mode,
        templates: knowledgeContextService.getDeterministicTemplates(),
      })
    : { kind: 'none' as const, responsePreview: null };

  return {
    senderId: row.instagram_id,
    createdAt: row.created_at,
    messageText: row.message_text,
    safetyAction: safety.action,
    safetyModel: safety.modelUsed,
    simpleTurnUsed: !!simpleAnalysis,
    fastLane: fastLane.kind,
    responseMode: analysis.responseDirective.mode,
    intentCategories: analysis.intentCategories,
    matchedKeywords: analysis.matchedKeywords,
    wouldNeedAIGeneration: safety.action === 'allow' && fastLane.kind === 'none',
    responsePreview: fastLane.responsePreview,
  };
}

function printReport(results: ReplayResult[]): void {
  const summary = results.reduce<Record<string, number>>((acc, result) => {
    const key = result.safetyAction !== 'allow'
      ? `safety:${result.safetyAction}`
      : result.fastLane !== 'none'
        ? `fast:${result.fastLane}`
        : result.wouldNeedAIGeneration
          ? 'needs_ai_generation'
          : 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log('\n=== Replay Summary ===');
  console.table(Object.entries(summary).map(([bucket, count]) => ({ bucket, count })));

  console.log('\n=== Replay Detail ===');
  console.table(results.map(result => ({
    createdAt: result.createdAt,
    senderId: result.senderId,
    safety: result.safetyAction,
    simpleTurn: result.simpleTurnUsed,
    fastLane: result.fastLane,
    mode: result.responseMode,
    needsAI: result.wouldNeedAIGeneration,
    message: result.messageText.slice(0, 80),
    preview: (result.responsePreview || '').slice(0, 80),
  })));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = new Database(options.dbPath, { readonly: true, fileMustExist: true });
  const contextService = new InstagramContextService(db);
  const knowledgeContextService = new DMKnowledgeContextService(db);

  const rows = getRecentRealInboundRows(db, options);
  if (rows.length === 0) {
    console.log('No matching inbound Instagram rows found.');
    db.close();
    return;
  }

  console.log(`Replaying ${rows.length} inbound messages from ${options.dbPath}`);
  const results: ReplayResult[] = [];
  for (const row of rows.reverse()) {
    results.push(await analyzeRow(row, contextService, knowledgeContextService));
  }

  printReport(results);
  db.close();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
