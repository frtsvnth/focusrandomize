import { z } from 'zod';

const mechanicIdSchema = z.enum([
  'wheel', 'slot', 'race', 'claw', 'cards', 'stickman',
  'elevator', 'tornado', 'dice', 'gladiator', 'alien', 'toyRace',
]);

const themeIdSchema = z.enum(['dark', 'light', 'neon', 'retro', 'space']);

const engineVersionSchema = z.enum(['v1', 'v2']);

const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  logo: z.string().optional(),
  enabled: z.boolean(),
});

const pickRecordSchema = z.object({
  teamId: z.string(),
  reason: z.enum(['forced-position', 'pinned-next', 'scripted-order', 'true-random']),
  timestamp: z.number(),
  stepIndex: z.number(),
});

const sessionSchema = z.object({
  activeTeamIds: z.array(z.string()),
  history: z.array(pickRecordSchema),
  mechanic: mechanicIdSchema,
  isActive: z.boolean(),
});

const scriptPlanSchema = z.object({
  fullOrder: z.array(z.string()).optional(),
  fixedPositions: z.record(z.number(), z.string()).optional(),
  pinnedNext: z.string().optional(),
  lastTeamId: z.string().optional(),
});

const animationHintSchema = z.object({
  seed: z.number(),
  durationMs: z.number(),
  suspenseMs: z.number(),
});

const debugMetaSchema = z.object({
  remainingOrder: z.array(z.string()).optional(),
  appliedRule: z.string(),
  poolSize: z.number(),
});

const selectionResultSchema = z.object({
  team: teamSchema,
  reason: z.enum(['forced-position', 'pinned-next', 'scripted-order', 'true-random']),
  animationHint: animationHintSchema,
  debugMeta: debugMetaSchema,
});

const settingsSchema = z.object({
  adminPin: z.string(),
  soundEnabled: z.boolean(),
  reducedMotion: z.boolean(),
  theme: themeIdSchema,
  enabledMechanics: z.array(mechanicIdSchema),
  engineVersion: engineVersionSchema.default('v1'),
});

const uiSchema = z.object({
  mode: z.enum(['presenter', 'admin']),
  isRevealing: z.boolean(),
  lastResult: selectionResultSchema.optional(),
  adminUnlocked: z.boolean(),
  historyVisible: z.boolean(),
});

export const appStateSchema = z.object({
  masterTeams: z.array(teamSchema),
  session: sessionSchema,
  scriptPlan: scriptPlanSchema,
  settings: settingsSchema,
  ui: uiSchema,
});

export type ValidatedAppState = z.infer<typeof appStateSchema>;
