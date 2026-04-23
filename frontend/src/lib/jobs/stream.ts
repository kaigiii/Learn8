"use client";

import { buildSseUrl } from "@/lib/apiClient";
import { JOB_STATUS } from "@/lib/domain/statuses";
import type { JobStreamEvent } from "@/lib/apiTypes";

interface OpenJobStreamHandlers {
  onEvent: (event: JobStreamEvent, source: EventSource) => void;
  onOpen?: (source: EventSource) => void;
  onError?: (source: EventSource) => void;
}

interface WatchJobStreamHandlers {
  onUpdate?: (event: JobStreamEvent, source: EventSource) => void;
  onCompleted?: (event: JobStreamEvent, source: EventSource) => void;
  onFailed?: (event: JobStreamEvent, source: EventSource) => void;
  onCancelled?: (event: JobStreamEvent, source: EventSource) => void;
  onStale?: (event: JobStreamEvent, source: EventSource) => void;
  onOpen?: (source: EventSource) => void;
  onError?: (source: EventSource) => void;
  autoClose?: boolean;
}

export function openJobStream(
  jobId: string,
  { onEvent, onOpen, onError }: OpenJobStreamHandlers
) {
  const source = new EventSource(buildSseUrl(jobId));

  source.onopen = () => {
    onOpen?.(source);
  };

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
    onOpen,
    onError,
    autoClose = true,
  }: WatchJobStreamHandlers
) {
  return openJobStream(jobId, {
    onOpen,
    onEvent: (event, source) => {
      onUpdate?.(event, source);

      if (
        event.status === JOB_STATUS.COMPLETED ||
        event.status === JOB_STATUS.FAILED ||
        event.status === JOB_STATUS.CANCELLED ||
        event.status === JOB_STATUS.STALE
      ) {
        source.close();
      }

      if (event.status === JOB_STATUS.COMPLETED) {
        onCompleted?.(event, source);
        return;
      }

      if (event.status === JOB_STATUS.FAILED) {
        onFailed?.(event, source);
        return;
      }

      if (event.status === JOB_STATUS.CANCELLED) {
        onCancelled?.(event, source);
        return;
      }

      if (event.status === JOB_STATUS.STALE) {
        onStale?.(event, source);
      }
    },
    onError: (source) => {
      if (autoClose) source.close();
      onError?.(source);
    },
  });
}
