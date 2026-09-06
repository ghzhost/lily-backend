let currentLagMs = 0;
let timer: NodeJS.Timeout | null = null;
let lastCheckTime: bigint = process.hrtime.bigint();

const SAMPLE_INTERVAL_MS = 500;

const sampleLag = () => {
  const expectedTime = lastCheckTime + BigInt(SAMPLE_INTERVAL_MS * 1_000_000);
  const now = process.hrtime.bigint();
  const deltaNs = Number(now - expectedTime);
  // Lag is extra delay beyond scheduled interval, bounded below by 0
  currentLagMs = Math.max(0, Number((deltaNs / 1_000_000).toFixed(3)));
  lastCheckTime = process.hrtime.bigint();
};

export const startEventLoopLagSampler = (intervalMs = SAMPLE_INTERVAL_MS): void => {
  if (timer) return;
  lastCheckTime = process.hrtime.bigint();
  timer = setInterval(sampleLag, intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
};

export const stopEventLoopLagSampler = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

export const getEventLoopLagMs = (): number => {
  // If sampler is not running or hasn't ticked yet, do a quick immediate check
  if (!timer) {
    startEventLoopLagSampler();
  }
  return currentLagMs;
};
