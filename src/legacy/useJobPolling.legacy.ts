// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: HTTP-polling job watcher.
//
// Polled GET /api/jobs/:id every 1.5s, recomputed per-source statuses, and
// fired a callback. Replaced by `useJobRealtime`, which subscribes to
// Postgres change events (jobs/sources/bytes tables) via supabase.channel.
//
// Imports below reference paths that no longer exist (`helpers/api#fetchJob`
// was dropped, `helpers/sourceStatuses-helpers` was moved to legacy/), so
// this file no longer compiles. Keep it as a reference for the polling
// pattern; do not import.
// ─────────────────────────────────────────────────────────────────────────────

// @ts-nocheck — broken imports below are intentional; this file is documentation only.
import { useEffect, useRef } from 'react';
import type { BackendJob, SourceStatus } from '../types';
import { fetchJob } from '../helpers/api';
import { getSourceStatuses } from '../helpers/sourceStatuses-helpers';

export function useJobPolling() {
	const stopPollingRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		return () => {
			stopPollingRef.current?.();
		};
	}, []);

	function pollJobSourceStatuses(
		jobId: string,
		onUpdate: (statuses: SourceStatus[], job: BackendJob) => void,
		intervalMs = 1500,
	) {
		let pollingStopped = false;
		let previousSourceStatuses = new Map<string, SourceStatus>();

		async function tick() {
			if (pollingStopped) return;

			const { job } = await fetchJob(jobId);

			const statuses = getSourceStatuses(job, previousSourceStatuses);
			previousSourceStatuses = new Map(
				statuses.map((sourceStatus) => [
					sourceStatus.sourceId,
					sourceStatus,
				]),
			);

			onUpdate(statuses, job);

			const generationStatus = job.generation?.status;
			const generationDone =
				generationStatus === 'generated' ||
				generationStatus === 'generated_with_errors' ||
				generationStatus === 'generation_failed' ||
				generationStatus === 'failed' ||
				generationStatus === 'skipped';

			const allExtractionsFailed =
				statuses.length > 0 &&
				statuses.every((sourceStatus) => sourceStatus.extractionStatus === 'failed');

			const done = generationDone || allExtractionsFailed;

			if (!done && !pollingStopped) {
				window.setTimeout(tick, intervalMs);
			}
		}

		void tick();

		return function stopPolling() {
			pollingStopped = true;
		};
	}

	return { stopPollingRef, pollJobSourceStatuses };
}
