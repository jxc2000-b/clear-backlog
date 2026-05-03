// HTTP client for the backend.
//
// After the Supabase migration this is a much smaller surface — the only
// state-changing call from the browser is `submitIntake`, and reads happen
// directly against Supabase via `useJobRealtime`. The old `fetchJob` polling
// helper is gone (see legacy/useJobPolling.legacy.ts for the previous flow).

import type { JobRow } from '../types';

const backendOrigin = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8787';

function backendUrl(path: string) {
	return new URL(path, backendOrigin).toString();
}

export async function submitIntake(payload: {
	youtubeVideoUrls: string[];
	articleUrls: string[];
	pdfs: { name: string; sizeBytes: number; data: string }[];
}): Promise<{ job: JobRow }> {
	const res = await fetch(backendUrl('/api/intake'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	return (await res.json()) as { job: JobRow };
}
