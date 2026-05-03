import { useEffect, useRef, useState } from 'react';
import type { ByteRow, JobRow, QueueItem } from './types';
import {
	ARTICLE_LIMIT,
	NOTIF_DISMISSED_KEY,
	PDF_LIMIT,
	PDF_MAX_BYTES,
	YOUTUBE_LIMIT,
} from './constants';
import { submitIntake } from './helpers/api';
import { testServiceWorkerNotification } from './helpers/testNotifications';
import { buildInitialSourceStatuses, sourceRowToStatus } from './helpers/sourceStatuses';
import { useJobRealtime } from './hooks/useJobRealtime';
import EntryView from './views/EntryView';
import ProcessingView from './views/ProcessingView';
import FinishedView from './views/FinishedView';

// ---------------------------------------------------------------------------------
// ---------------------------------HELPERS-----------------------------------------
// ---------------------------------------------------------------------------------

function NotificationPrompt({ onDismiss }: { onDismiss: () => void }) {
	async function allow() {
		await Notification.requestPermission();
		onDismiss();
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
			id="notification-permission-modal-container"
		>
			<div
				className="w-full max-w-sm border border-gray-200 bg-white px-6 py-6 shadow-lg"
				id="notification-permissional-modal"
			>
				<p className="mb-1 text-base font-semibold text-black">
					Enable notifications
				</p>
				<p className="mb-5 text-sm text-gray-500">
					Get notified when your links are done processing, this is neccessary
					for this app to function.
				</p>
				<div className="flex gap-3">
					<button
						onClick={allow}
						className="bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-500"
						id="allow-button"
					>
						Allow
					</button>
					<button
						onClick={onDismiss}
						className="px-5 py-2 text-sm text-gray-500 transition hover:text-black"
						id="notnow-button"
					>
						Not now
					</button>
				</div>
			</div>
		</div>
	);
}

function readFileAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

// Job statuses that mean the pipeline is done, regardless of success/failure.
const TERMINAL_STATUSES = new Set([
	'generated',
	'generated_with_errors',
	'generation_failed',
	'failed',
]);

// ---------------------------------------------------------------------------------
// ---------------------------------APP-----------------------------------------
// ---------------------------------------------------------------------------------
function App() {
	const [youtubeInput, setYoutubeInput] = useState('');
	const [articleInput, setArticleInput] = useState('');
	const [queue, setQueue] = useState<QueueItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const [showNotifPrompt, setShowNotifPrompt] = useState(false);
	const [jobId, setJobId] = useState<string | null>(null);
	const [view, setView] = useState<'entry' | 'processing' | 'finished'>('entry');

	// Realtime subscription. Returns the job row + its sources + its bytes,
	// auto-updating as Postgres changes stream in. Replaces useJobPolling.
	const { job, sources, bytes } = useJobRealtime(jobId);

	const notificationTimersRef = useRef<number[]>([]);
	// Tracks which jobIds have already triggered notifications, so a re-render
	// of a finished job doesn't re-schedule them.
	const notifiedJobIdRef = useRef<string | null>(null);

	function clearScheduledNotifications() {
		for (const id of notificationTimersRef.current) {
			window.clearTimeout(id);
		}
		notificationTimersRef.current = [];
	}

	useEffect(() => {
		if (!('Notification' in window)) return;
		if (Notification.permission === 'granted') return;
		// if (Notification.permission !== 'default') return;
		// if (localStorage.getItem(NOTIF_DISMISSED_KEY)) return;
		const t = setTimeout(() => setShowNotifPrompt(true), 5000);
		return () => clearTimeout(t); //incase of unmount clear timer
	}, []);

	// Drive view transitions + notifications off the realtime job status. Runs
	// any time the live status changes — when the worker writes 'generated',
	// this fires once and switches to the FinishedView.
	useEffect(() => {
		if (!job) return;
		if (TERMINAL_STATUSES.has(job.status)) {
			setView('finished');

			// Only fire notifications once per job. The realtime hook will keep
			// updating `job` (e.g. updated_at), and we don't want to re-schedule
			// each time.
			if (notifiedJobIdRef.current !== job.id) {
				notifiedJobIdRef.current = job.id;
				void sendNotifications(bytes);
			}
		}
		// `bytes` is intentionally read at fire time, not depended upon, so we
		// don't re-trigger when bytes arrive after the status flips.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [job?.status, job?.id]);

	function dismissNotifPrompt() {
		localStorage.setItem(NOTIF_DISMISSED_KEY, '1');
		setShowNotifPrompt(false);
	}

	const ytCount = queue.filter((i) => i.type === 'youtube').length;
	const artCount = queue.filter((i) => i.type === 'article').length;
	const pdfCount = queue.filter((i) => i.type === 'pdf').length;

	function addYoutube(): string | null {
		const url = youtubeInput.trim();
		if (!url) return null;
		if (ytCount >= YOUTUBE_LIMIT) return `Limit of ${YOUTUBE_LIMIT} youtube videos hit`;
		setQueue((q) => [...q, { id: crypto.randomUUID(), type: 'youtube', url }]);
		setYoutubeInput('');
		return null;
	}

	function addArticle(): string | null {
		const url = articleInput.trim();
		if (!url) return null;
		if (artCount >= ARTICLE_LIMIT) return `Limit of ${ARTICLE_LIMIT} articles hit`;
		setQueue((q) => [...q, { id: crypto.randomUUID(), type: 'article', url }]);
		setArticleInput('');
		return null;
	}

	function addPdfs(files: FileList | null) {
		if (!files) return;
		const remaining = PDF_LIMIT - pdfCount;
		const valid = Array.from(files)
			.filter((f) => f.size <= PDF_MAX_BYTES)
			.slice(0, remaining);

		if (valid.length) {
			setQueue((q) => [
				...q,
				...valid.map((file) => ({
					id: crypto.randomUUID(),
					type: 'pdf' as const,
					file,
				})),
			]);
		}
	}

	function remove(id: string) {
		setQueue((q) => q.filter((i) => i.id !== id));
	}

	function backToEntry() {
		clearScheduledNotifications();
		notifiedJobIdRef.current = null;
		setJobId(null);    // also unsubscribes the realtime channel
		setView('entry');
		setStatus(null);
	}

	async function handleSubmit() {
		if (!queue.length || isLoading) return;
		setIsLoading(true);
		setStatus(null);
		setView('processing');

		try {
			const pdfFiles = queue
				.filter((i): i is Extract<QueueItem, { type: 'pdf' }> => i.type === 'pdf')
				.map((i) => i.file);
			const pdfs = await Promise.all(
				pdfFiles.map(async (file) => ({
					name: file.name,
					sizeBytes: file.size,
					data: await readFileAsDataUrl(file),
				})),
			);

			const { job: createdJob } = await submitIntake({
				youtubeVideoUrls: queue
					.filter(
						(i): i is Extract<QueueItem, { type: 'youtube' }> =>
							i.type === 'youtube',
					)
					.map((i) => i.url),
				articleUrls: queue
					.filter(
						(i): i is Extract<QueueItem, { type: 'article' }> =>
							i.type === 'article',
					)
					.map((i) => i.url),
				pdfs,
			});

			setJobId(createdJob.id);   // useJobRealtime takes it from here
			setStatus('Processing...');
		} catch {
			setStatus('Something went wrong. Please try again.');
		} finally {
			setIsLoading(false);
		}
	}

	async function sendNotifications(jobBytes: ByteRow[]) {
		console.log('[notifications] starting');

		if (!('serviceWorker' in navigator)) {
			console.error('[notifications] FAIL: service workers not supported in this browser');
			return false;
		}
		if (!('Notification' in window)) {
			console.error('[notifications] FAIL: notifications not supported in this browser');
			return false;
		}

		let permission = Notification.permission;
		console.log('[notifications] permission state:', permission);

		if (permission === 'default') {
			console.log('[notifications] requesting permission...');
			permission = await Notification.requestPermission();
			console.log('[notifications] permission after request:', permission);
		}

		if (permission !== 'granted') {
			console.error('[notifications] FAIL: permission is', permission);
			return false;
		}

		console.log('[notifications] waiting for navigator.serviceWorker.ready...');
		const registration = await navigator.serviceWorker.ready;
		console.log('[notifications] sw ready, scope:', registration.scope, 'active:', !!registration.active);

		try {
			await registration.showNotification('Clear-Backlog: bytes ready', {
				body: `${jobBytes.length} byte${jobBytes.length !== 1 ? 's' : ''} generated. Delivering one per minute.`,
				icon: '/eyes-192.png',
				badge: '/eyes-192.png',
				tag: 'cb-bytes-ready',
				requireInteraction: false,
			});
			console.log('[notifications] confirmation notification shown');
		} catch (err) {
			console.error('[notifications] FAIL: confirmation showNotification threw', err);
			return false;
		}

		clearScheduledNotifications();
		jobBytes.forEach((byte, index) => {
			const timerId = window.setTimeout(async () => {
				try {
					const reg = await navigator.serviceWorker.ready;
					await reg.showNotification(byte.speaker || `Byte ${byte.index + 1}`, {
						body: byte.quote
							? `"${byte.quote}"\n\n${byte.commentary ?? ''}`
							: byte.text ?? '',
						icon: '/eyes-192.png',
						badge: '/eyes-192.png',
						tag: `cb-byte-${byte.source_id}-${byte.index}`,
						requireInteraction: false,
					});
					console.log('[notifications] byte notification shown', byte.source_id, byte.index);
				} catch (err) {
					console.error('[notifications] byte showNotification threw', err);
				}
			}, (index + 1) * 60_000);
			notificationTimersRef.current.push(timerId);
		});

		console.log('[notifications] PASS: scheduled', jobBytes.length, 'byte notification(s)');
		return true;
	}

	// Per-source UI status. Once the realtime hook has rows, we project them
	// into the SourceStatus shape the views consume. Before submission (no
	// jobId yet), we project the local queue instead so the Processing view
	// has placeholder rows during the brief window between submit and the
	// first realtime update.
	const visibleSourceStatuses =
		sources.length > 0 ? sources.map(sourceRowToStatus) : buildInitialSourceStatuses(queue);

	return (
		<>
			{showNotifPrompt && <NotificationPrompt onDismiss={dismissNotifPrompt} />}

			<main className="min-h-screen bg-white px-6 py-10 text-black">
				<header className="mb-14 flex items-center justify-between">
					<p className="text-2xl font-semibold">Clear-Backlog</p>
					<button
						type="button"
						onClick={testServiceWorkerNotification}
						className="border border-gray-300 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:border-black hover:text-black"
					>
						Test SW notification
					</button>
				</header>

				<section className="mx-auto max-w-xl overflow-hidden">
					<div
						className={`flex w-[200%] transition-transform duration-500 ease-out ${
							view !== 'entry' ? '-translate-x-1/2' : 'translate-x-0'
						}`}
					>
						<EntryView
							queue={queue}
							isLoading={isLoading}
							ytCount={ytCount}
							artCount={artCount}
							pdfCount={pdfCount}
							youtubeInput={youtubeInput}
							setYoutubeInput={setYoutubeInput}
							articleInput={articleInput}
							setArticleInput={setArticleInput}
							addYoutube={addYoutube}
							addArticle={addArticle}
							addPdfs={addPdfs}
							remove={remove}
							handleSubmit={handleSubmit}
						/>

						{view === 'finished' && job ? (
							<FinishedView
								backToEntry={backToEntry}
								job={job}
								sources={sources}
								bytes={bytes}
							/>
						) : (
							<ProcessingView
								backToEntry={backToEntry}
								activeJob={job}
								visibleSourceStatuses={visibleSourceStatuses}
								status={status}
							/>
						)}
					</div>
				</section>
			</main>
		</>
	);
}

export default App;
