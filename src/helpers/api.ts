import type { BackendJob } from '../types';

export async function submitIntake(payload: {
	youtubeVideoUrls: string[];
	articleUrls: string[];
	pdfs: { name: string; sizeBytes: number; data: string }[];
}): Promise<{ job: BackendJob }> {
	const res = await fetch('/api/intake', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	return (await res.json()) as { job: BackendJob };
}

export async function fetchJob(jobId: string): Promise<{ job: BackendJob }> {
	const res = await fetch(`/api/jobs/${jobId}`);
	return (await res.json()) as { job: BackendJob };
}
