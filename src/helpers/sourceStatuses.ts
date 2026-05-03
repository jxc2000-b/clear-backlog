// Helpers for turning data into the UI-layer `SourceStatus` shape used by
// EntryView/ProcessingView/FinishedView. Two inputs supported:
//
//   * QueueItem[]   — the user's pending submission, before a job exists.
//                     Used to render placeholder rows in the Processing view
//                     while the intake response is in flight.
//
//   * SourceRow[]   — live rows from Supabase via the realtime hook. Used to
//                     render actual extraction/generation progress.
//
// The shape difference between SourceRow and SourceStatus is purely casing
// (snake_case → camelCase) plus a couple of computed fields, so the
// conversion is mechanical.

import type { QueueItem, SourceRow, SourceStatus } from '../types';

export function buildInitialSourceStatuses(items: QueueItem[]): SourceStatus[] {
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

// Convert a SourceRow from Supabase into the SourceStatus shape the views
// already render. The "changed" flag is no longer meaningful here (we used
// it before to short-circuit re-renders during polling); leaving it as `true`
// has no visible effect on the views and avoids carrying old-state diffing.
export function sourceRowToStatus(row: SourceRow): SourceStatus {
	return {
		sourceId: row.source_id,
		type: row.type,
		source: row.source,
		extractionStatus: row.extraction_status,
		generationStatus: row.generation_status,
		message: row.message ?? defaultMessage(row),
		changed: true,
		textLength: row.text_length ?? undefined,
	};
}

// Fallback message when the row hasn't set one yet (e.g. brand-new row from
// createJob with NULL message). Keeps the UI from rendering a blank line.
function defaultMessage(row: SourceRow): string {
	if (row.error) return row.error;
	switch (row.extraction_status) {
		case 'queued':
			return 'Queued';
		case 'extracting':
			return 'Extracting text...';
		case 'text-retrieved':
			return 'Text retrieved';
		case 'failed':
			return 'Extraction failed';
	}
}
