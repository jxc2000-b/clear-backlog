// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: helpers that turned an old-shape BackendJob (nested
// extraction/generation objects) into a flat per-source status list for the
// UI. Replaced by `helpers/sourceStatuses.ts`, which works directly with the
// normalized SourceRow shape from Supabase. Preserved as a reference for the
// status/derivation logic.
// ─────────────────────────────────────────────────────────────────────────────

import type { BackendJob, QueueItem, SourceStatus } from '../types';

export function buildInitialSourceStatuses(items: QueueItem[]): SourceStatus[] { //builds the initial source statuses
	let youtubeIndex = 0;
	let articleIndex = 0;
	let pdfIndex = 0;

	return items.map((item) => {
		if (item.type === 'youtube') {
			const sourceStatus: SourceStatus = {
				sourceId: `youtube:${youtubeIndex}`,
				type: 'youtube',
				source: item.url,
				extractionStatus: 'queued',
				message: 'Queued',
				changed: false,
			};
			youtubeIndex += 1;
			return sourceStatus;
		}

		if (item.type === 'article') {
			const sourceStatus: SourceStatus = {
				sourceId: `article:${articleIndex}`,
				type: 'article',
				source: item.url,
				extractionStatus: 'queued',
				message: 'Queued',
				changed: false,
			};
			articleIndex += 1;
			return sourceStatus;
		}

		const sourceStatus: SourceStatus = {
			sourceId: `pdf:${pdfIndex}`,
			type: 'pdf',
			source: item.file.name,
			extractionStatus: 'queued',
			message: 'Queued',
			changed: false,
		};
		pdfIndex += 1;
		return sourceStatus;
	});
}

export function getJobSourceList(job: BackendJob) {
	return [
		...job.sources.youtubeVideoUrls.map((source, index) => ({
			sourceId: `youtube:${index}`,
			type: 'youtube' as const,
			source,
		})),

		...job.sources.articleUrls.map((source, index) => ({
			sourceId: `article:${index}`,
			type: 'article' as const,
			source,
		})),

		...job.sources.pdfs.map((pdf, index) => ({
			sourceId: `pdf:${index}`,
			type: 'pdf' as const,
			source: pdf.name ?? `PDF ${index + 1}`,
		})),
	];
}

export function getSourceStatuses(
	job: BackendJob,
	previous = new Map<string, SourceStatus>(),
) {
	const results = new Map(
		job.extraction?.results.map((result) => [result.sourceId, result]),
	);
	const errors = new Map(
		job.extraction?.errors.map((error) => [error.sourceId, error]),
	);

	return getJobSourceList(job).map((source): SourceStatus => {
		const result = results.get(source.sourceId);
		const error = errors.get(source.sourceId);

		let next: Omit<SourceStatus, 'changed'>;

		if (result) {
			next = {
				...source,
				extractionStatus: 'text-retrieved',
				message: 'Text retrieved ssuccessfully',
				textLength: result.length,
			};
		} else if (error) {
			next = {
				...source,
				extractionStatus: 'failed',
				message: error.message,
			};
		} else if (job.extraction) {
			next = {
				...source,
				extractionStatus: 'extracting',
				message: 'Extracting text...',
			};
		} else {
			next = {
				...source,
				extractionStatus: 'queued',
				message: 'Queued',
			};
		}

		const old = previous.get(source.sourceId);

		return {
			...next,
			changed: old?.extractionStatus !== next.extractionStatus || old?.message !== next.message,
		};
	});
}
