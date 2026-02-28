export type MomentumColor = 'green' | 'amber' | 'red';

/**
 * Map a momentum/similarity score (0-100) to a color band.
 * green ≥ 70, amber 40-69, red < 40
 */
export function getMomentumColor(score: number): MomentumColor {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

/**
 * Sort tasks by descending momentum similarity.
 * Tasks without a similarity entry keep their original order at the end.
 */
export function sortByMomentum<T extends { id?: string; job_id?: string }>(
  tasks: T[],
  similarities: Array<{ job_id: string; similarity: number }>,
): T[] {
  const simMap = new Map(similarities.map((s) => [s.job_id, s.similarity]));
  return [...tasks].sort((a, b) => {
    const idA = a.job_id ?? a.id ?? '';
    const idB = b.job_id ?? b.id ?? '';
    const simA = simMap.get(idA) ?? -1;
    const simB = simMap.get(idB) ?? -1;
    return simB - simA;
  });
}

/**
 * Map a bandwidth percentage (0-100) to a color.
 * red > 80, green < 50, amber otherwise
 */
export function getBandwidthColor(bandwidth: number): MomentumColor {
  if (bandwidth > 80) return 'red';
  if (bandwidth < 50) return 'green';
  return 'amber';
}

/**
 * Calculate bandwidth as (runningJobs / activeAgents) × 100, clamped 0-100.
 * Returns 0 when no active agents.
 */
export function calculateBandwidth(runningJobs: number, activeAgents: number): number {
  if (activeAgents <= 0) return 0;
  return Math.min(100, Math.max(0, (runningJobs / activeAgents) * 100));
}
