import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";

import { env } from "../../config/env";
import type { ProcessMetrics } from "./metrics.types";

let histogram: IntervalHistogram | null = null;

const getHistogram = (): IntervalHistogram => {
  if (!histogram) {
    histogram = monitorEventLoopDelay({ resolution: 20 });
    histogram.enable();
  }
  return histogram;
};

export const getEventLoopLagMs = (): number => {
  const h = getHistogram();
  const mean = h.mean;
  if (!Number.isFinite(mean) || mean <= 0) {
    return 0;
  }
  return Number((mean / 1_000_000).toFixed(2));
};

export const metricsService = {
  getMetrics: (): ProcessMetrics => {
    const memory = process.memoryUsage();
    return {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: {
        rssBytes: memory.rss,
        heapTotalBytes: memory.heapTotal,
        heapUsedBytes: memory.heapUsed,
        externalBytes: memory.external,
      },
      eventLoopLagMs: getEventLoopLagMs(),
      nodeVersion: process.version,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  },
};
