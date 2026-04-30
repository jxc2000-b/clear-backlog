import { useEffect, useRef } from 'react';
import type { BackendJob, SourceStatus } from '../types';
import { fetchJob } from '../helpers/api';
import { getSourceStatuses } from '../helpers/sourceStatuses';

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
		let stopped = false;
		let previous = new Map<string, SourceStatus>();

		async function tick() {
			if (stopped) return;

			const { job } = await fetchJob(jobId);

			const statuses = getSourceStatuses(job, previous);
			previous = new Map(
				statuses.map((sourceStatus) => [
					sourceStatus.sourceId,
					sourceStatus,
				]),
			);

			onUpdate(statuses, job);

			const done = statuses.every(
				(sourceStatus) =>
					sourceStatus.extractionStatus === 'text-retrieved' ||
					sourceStatus.extractionStatus === 'failed',
			);

			if (!done && !stopped) {
				window.setTimeout(tick, intervalMs);
			}
		}

		void tick();

		return () => {
			stopped = true;
		};
	}

	return { stopPollingRef, pollJobSourceStatuses };
}
