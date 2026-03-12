# Master PR Note: DM Humanizer

Use this note when opening the next `master` PR from `codex/turkish-dm-humanizer`.

## Recommended PR Title
`feat: harden Instagram DM replies with Turkish humanizer and reliability fixes`

## Base and Scope
- Base branch: `master`
- Head branch: `codex/turkish-dm-humanizer`
- Intended committed scope: `f552f0f..c31eb64`
- Do not include the current uncommitted OpenClaw ops/docs work in this PR.

## Why This PR
- Reduce robotic Turkish DM phrasing and repetitive closers.
- Keep campaign and generic-info follow-ups grounded to KB-backed answers.
- Improve resilience when Meta send attempts fail transiently.
- Restore short-fragment inbound buffering so multi-part customer messages are handled more naturally.
- Expose DM cache state in DM Kontrol so operators can inspect fast-lane behavior.

## Included Changes
- Added `TurkishDMHumanizerService` with rule-based post-processing plus trace output.
- Wired humanizer flow into both the real Instagram webhook pipeline and the workflow simulator.
- Added humanizer config defaults and tests in `PipelineConfigService`.
- Extended `DMResponseStyleService` so anti-repetition style steering is enabled only when the humanizer is on.
- Tightened the generic info opener so deterministic replies stay more natural.
- Added retry handling for transient Meta send failures.
- Fixed campaign follow-ups so they stay on KB-backed paths instead of falling back to contact answers.
- Restored Instagram inbound aggregation for short fragmented turns.
- Added DM cache inspection surfaces in DM Kontrol plus agent/operator docs.
- Added conduct-guide documentation updates that shipped alongside this branch.

## Test Evidence
- Manual validation: DM humanizer behavior was tested before preparing this PR.
- Automated verification run on March 12, 2026 under Node `18.20.8`:

```bash
fnm exec --using 18.20.8 cmd /c npm run test --workspace=backend -- src/services/TurkishDMHumanizerService.test.ts src/services/DMResponseStyleService.test.ts src/services/PipelineConfigService.test.ts src/services/GenericInfoTemplateService.test.ts src/services/DMPipelineHeuristics.test.ts src/services/DMRealTrafficRegression.test.ts src/services/DMInboundAggregationService.test.ts src/services/DMResponseCacheService.test.ts src/routes/instagramIntegrationRoutes.test.ts
```

- Result: `9` test files passed, `75` tests passed.

## Risk Notes
- This PR changes live DM behavior. Review `docs/agent-runtime-memory.md` before deploy.
- This PR does not include the later OpenClaw ops/dashboard work or Pi sync helpers now sitting uncommitted in the local tree.
- Pi OpenClaw version parity is still separate work; this PR is about DM behavior and supporting operator surfaces.

## Suggested Merge Checklist
1. Open the PR from `codex/turkish-dm-humanizer` into `master`.
2. Keep the diff limited to the committed branch history through `c31eb64`.
3. Exclude the current uncommitted OpenClaw ops/docs changes from the PR.
4. Re-run the targeted backend suite above before merge if more DM changes land first.
5. After merge, deploy backend/frontend normally and then verify with the DM simulator plus one real low-risk DM turn.
