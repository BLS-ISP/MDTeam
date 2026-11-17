import { AsyncLocalStorage } from "node:async_hooks";

const heldProjectLocks = new AsyncLocalStorage<ReadonlySet<string>>();
const projectLockTails = new Map<string, Promise<void>>();

function normalizeProjectLockKey(rawProjectId: string): string {
  try {
    return decodeURIComponent(rawProjectId || "").trim().toLowerCase() || "__empty__";
  } catch {
    return (rawProjectId || "").trim().toLowerCase() || "__empty__";
  }
}

/**
 * Per-project FIFO async mutex with AsyncLocalStorage re-entrancy.
 * Serializes concurrent Git operations on the same repository so parallel
 * file saves, commits, branch checkouts, and remote syncs never collide on `.git/index.lock`,
 * while allowing nested helpers (e.g. `ensureProjectRepository` or `commit` -> `push`)
 * within the same async call chain to proceed without deadlocking.
 */
export async function withProjectGitLock<T>(
  rawProjectId: string,
  task: () => Promise<T>
): Promise<T> {
  const key = normalizeProjectLockKey(rawProjectId);
  const currentlyHeld = heldProjectLocks.getStore();
  if (currentlyHeld?.has(key)) {
    return task();
  }

  const previousTail = projectLockTails.get(key) ?? Promise.resolve();
  let releaseGate!: () => void;
  const currentGate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  const nextTail = previousTail.then(() => currentGate);
  projectLockTails.set(key, nextTail);

  await previousTail;

  const nextHeld = new Set(currentlyHeld);
  nextHeld.add(key);

  try {
    return await heldProjectLocks.run(nextHeld, task);
  } finally {
    releaseGate();
    if (projectLockTails.get(key) === nextTail) {
      projectLockTails.delete(key);
    }
  }
}
