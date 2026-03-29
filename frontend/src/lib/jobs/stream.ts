"use client";

import { buildSseUrl } from "@/lib/apiClient";
import { JOB_STATUS } from "@/lib/domain/statuses";
import type { JobStreamEvent } from "@/lib/apiTypes";

interface OpenJobStreamHandlers {
  onEvent: (event: JobStreamEvent, source: EventSource) => void;
  onError?: (source: EventSource) => void;
}

interface WatchJobStreamHandlers {
  onUpdate?: (event: JobStreamEvent, source: EventSource) => void;
  onCompleted?: (event: JobStreamEvent, source: EventSource) => void;
  onFailed?: (event: JobStreamEvent, source: EventSource) => void;
  onCancelled?: (event: JobStreamEvent, source: EventSource) => void;
  onStale?: (event: JobStreamEvent, source: EventSource) => void;
  onError?: (source: EventSource) => void;
  autoClose?: boolean;
}

export function openJobStream(
  jobId: string,
  { onEvent, onError }: OpenJobStreamHandlers
) {
  const source = new EventSource(buildSseUrl(jobId));

  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as JobStreamEvent;
      onEvent(payload, source);
    } catch {
      // Ignore malformed SSE payloads.
    }
  };

  source.onerror = () => {
    onError?.(source);
  };

  return source;
}

export function watchJobStream(
  jobId: string,
  {
    onUpdate,
    onCompleted,
    onFailed,
    onCancelled,
    onStale,
    onError,
    autoClose = true,
  }: WatchJobStreamHandlers
) {
  return openJobStream(jobId, {
    onEvent: (event, source) => {
      onUpdate?.(event, source);

      if (event.status === JOB_STATUS.COMPLETED) {
        if (autoClose) source.close();
        onCompleted?.(event, source);
        return;
      }

      if (event.status === JOB_STATUS.FAILED) {
        if (autoClose) source.close();
        onFailed?.(event, source);
        return;
      }

      if (event.status === JOB_STATUS.CANCELLED) {
        if (autoClose) source.close();
        onCancelled?.(event, source);
        return;
      }

      if (event.status === JOB_STATUS.STALE) {
        if (autoClose) source.close();
        onStale?.(event, source);
      }
    },
    onError: (source) => {
      if (autoClose) source.close();
      onError?.(source);
    },
  });
}
