// Realtime subscription to a job's state.
//
// Replaces the old `useJobPolling` hook (now under legacy/). Instead of GET
// /api/jobs/:id every 1.5s, we:
//   1. Fetch the initial { job, sources, bytes } snapshot from Supabase once.
//   2. Open a single websocket channel and listen for postgres_changes on
//      the three relevant tables, filtered to this job_id.
//   3. Apply each event to local state — INSERT/UPDATE merge into the array,
//      DELETE removes by id.
//
// The channel auto-reconnects if the websocket drops. `useEffect`'s cleanup
// removes the channel when the component unmounts or `jobId` changes.
//
// Returns three pieces of state plus a `loading` flag:
//   - job:     JobRow | null    (top-level row)
//   - sources: SourceRow[]      (one per intake source, ordered by source_id)
//   - bytes:   ByteRow[]        (LLM-generated, ordered by index)
//   - loading: boolean          (true until the initial fetch resolves)

import { useEffect, useState } from 'react';
import { supabase } from '../helpers/supabase';
import type { ByteRow, JobRow, SourceRow } from '../types';

type RealtimeJob = {
	job: JobRow | null;
	sources: SourceRow[];
	bytes: ByteRow[];
	loading: boolean;
};

const EMPTY: RealtimeJob = { job: null, sources: [], bytes: [], loading: false };

export function useJobRealtime(jobId: string | null): RealtimeJob {
	const [state, setState] = useState<RealtimeJob>(EMPTY);

	useEffect(() => {
		if (!jobId) {
			setState(EMPTY);
			return;
		}

		// `cancelled` guards against the initial fetch resolving after the
		// component has switched to a different jobId or unmounted.
		let cancelled = false;
		setState({ ...EMPTY, loading: true });

		// ── 1. initial fetch ──
		void Promise.all([
			supabase.from('jobs').select('*').eq('id', jobId).maybeSingle(),
			supabase.from('sources').select('*').eq('job_id', jobId).order('source_id'),
			supabase.from('bytes').select('*').eq('job_id', jobId).order('index'),
		]).then(([jobRes, sourcesRes, bytesRes]) => {
			if (cancelled) return;
			setState({
				job: (jobRes.data as JobRow | null) ?? null,
				sources: (sourcesRes.data as SourceRow[] | null) ?? [],
				bytes: (bytesRes.data as ByteRow[] | null) ?? [],
				loading: false,
			});
		});

		// ── 2. realtime subscription ──
		// One channel per job. Three filters, one per table. The filter syntax
		// is Supabase-specific: `column=eq.value`.
		const channel = supabase
			.channel(`job-${jobId}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
				(payload) => {
					if (cancelled) return;
					if (payload.eventType === 'DELETE') {
						setState((prev) => ({ ...prev, job: null }));
						return;
					}
					setState((prev) => ({ ...prev, job: payload.new as JobRow }));
				},
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'sources', filter: `job_id=eq.${jobId}` },
				(payload) => {
					if (cancelled) return;
					setState((prev) => {
						if (payload.eventType === 'INSERT') {
							return { ...prev, sources: [...prev.sources, payload.new as SourceRow] };
						}
						if (payload.eventType === 'UPDATE') {
							const next = payload.new as SourceRow;
							return {
								...prev,
								sources: prev.sources.map((row) => (row.id === next.id ? next : row)),
							};
						}
						if (payload.eventType === 'DELETE') {
							const old = payload.old as SourceRow;
							return { ...prev, sources: prev.sources.filter((row) => row.id !== old.id) };
						}
						return prev;
					});
				},
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'bytes', filter: `job_id=eq.${jobId}` },
				(payload) => {
					if (cancelled) return;
					setState((prev) => {
						if (payload.eventType === 'INSERT') {
							const incoming = payload.new as ByteRow;
							// Defend against duplicates if the initial fetch and the realtime
							// event race — keep the realtime payload and dedupe by id.
							if (prev.bytes.some((b) => b.id === incoming.id)) return prev;
							return { ...prev, bytes: [...prev.bytes, incoming] };
						}
						// Bytes are insert-only in practice; updates/deletes shouldn't happen,
						// but handle them defensively so a future schema change doesn't break.
						if (payload.eventType === 'UPDATE') {
							const next = payload.new as ByteRow;
							return {
								...prev,
								bytes: prev.bytes.map((row) => (row.id === next.id ? next : row)),
							};
						}
						if (payload.eventType === 'DELETE') {
							const old = payload.old as ByteRow;
							return { ...prev, bytes: prev.bytes.filter((row) => row.id !== old.id) };
						}
						return prev;
					});
				},
			)
			.subscribe();

		return () => {
			cancelled = true;
			void supabase.removeChannel(channel);
		};
	}, [jobId]);

	return state;
}
