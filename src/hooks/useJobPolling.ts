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
