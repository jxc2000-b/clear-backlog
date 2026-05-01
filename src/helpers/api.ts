import type { BackendJob } from '../types';

const backendOrigin = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8787';
function backendUrl(path: string) {
	return new URL(path, backendOrigin).toString();
}

export async function submitIntake(payload: {
	youtubeVideoUrls: string[];
	articleUrls: string[];
	pdfs: { name: string; sizeBytes: number; data: string }[];
}): Promise<{ job: BackendJob }> {
	const res = await fetch(backendUrl('/api/intake'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	return (await res.json()) as { job: BackendJob };
}

export async function fetchJob(jobId: string): Promise<{ job: BackendJob }> {
	const res = await fetch(backendUrl(`/api/jobs/${jobId}`));
	return (await res.json()) as { job: BackendJob };
}
