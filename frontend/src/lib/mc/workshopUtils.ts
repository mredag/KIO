export interface Job {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface JobCounts {
  queued: number;
  active: number;
  completed: number;
}

export interface PartitionedJobs {
  queued: Job[];
  active: Job[];
  completed: Job[];
}

const ACTIVE_STATUSES = new Set(['running', 'waiting_input']);

/**
 * Count jobs by logical status bucket.
 * queued = "queued", active = "running" | "waiting_input", completed = "completed"
 */
export function countJobsByStatus(jobs: Job[]): JobCounts {
  let queued = 0;
  let active = 0;
  let completed = 0;

  for (const job of jobs) {
    if (job.status === 'queued') queued++;
    else if (ACTIVE_STATUSES.has(job.status)) active++;
    else if (job.status === 'completed') completed++;
  }

  return { queued, active, completed };
}

/**
 * Partition jobs into three Kanban column arrays.
 * queued → Queued, running/waiting_input → Active, completed → Completed
 */
export function partitionJobs(jobs: Job[]): PartitionedJobs {
  const queued: Job[] = [];
  const active: Job[] = [];
  const completed: Job[] = [];

  for (const job of jobs) {
    if (job.status === 'queued') queued.push(job);
    else if (ACTIVE_STATUSES.has(job.status)) active.push(job);
    else if (job.status === 'completed') completed.push(job);
  }

  return { queued, active, completed };
}
