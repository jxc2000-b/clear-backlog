// HTTP client for the backend.
//
// After the Supabase migration this is a much smaller surface — the only
// state-changing call from the browser is `submitIntake`, and reads happen
// directly against Supabase via `useJobRealtime`. The old `fetchJob` polling
// helper is gone (see legacy/useJobPolling.legacy.ts for the previous flow).

import type { JobRow } from '../types';
import { supabase } from './supabase';

const backendOrigin = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8787';
const netlifyOrigin = import.meta.env.VITE_NETLIFY_URL ?? '';
type Target = 'node' | 'netlify' | 'supabase';
const target = (import.meta.env.VITE_DEPLOY_TARGET ?? 'node') as Target;

function backendUrl(path: string) {
	return new URL(path, backendOrigin).toString();
}

function netlifyUrl(path: string) {
	return new URL(path, netlifyOrigin || window.location.origin).toString();
}

export async function submitIntake(payload: {
	youtubeVideoUrls: string[];
	articleUrls: string[];
	pdfs: { name: string; sizeBytes: number; data: string }[];
}): Promise<{ job: JobRow }> {
	if (target === 'supabase') {
		const { data, error } = await supabase.functions.invoke('intake', { body: payload });
		if (error) throw error;
		return data as { job: JobRow };
	}

	const res = await fetch(target === 'netlify' ? netlifyUrl('/api/intake') : backendUrl('/api/intake'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});

	const body = await res.json();
	if (!res.ok) {
		throw new Error((body as { error?: string; errors?: string[] }).error ?? (body as { errors?: string[] }).errors?.join('\n') ?? 'Intake failed.');
	}
	return body as { job: JobRow };
}
