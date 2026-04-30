import { useEffect, useState } from 'react';
import type { BackendJob, QueueItem, SourceStatus } from './types';
import {
	ARTICLE_LIMIT,
	NOTIF_DISMISSED_KEY,
	PDF_LIMIT,
	PDF_MAX_BYTES,
	YOUTUBE_LIMIT,
} from './constants';
import { submitIntake } from './helpers/api';
import { testServiceWorkerNotification } from './helpers/notifications';
import {
	getQueueSourceStatuses,
	getSourceStatuses,
} from './helpers/sourceStatuses';
import { useJobPolling } from './hooks/useJobPolling';
import EntryView from './views/EntryView';
import ProcessingView from './views/ProcessingView';

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
	const [activeJob, setActiveJob] = useState<BackendJob | null>(null);
	const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);
	const [view, setView] = useState<'entry' | 'processing'>('entry');
	const { stopPollingRef, pollJobSourceStatuses } = useJobPolling();

	useEffect(() => {
		if (!('Notification' in window)) return;
		if (Notification.permission === 'granted') return;
		// if (Notification.permission !== 'default') return;
		// if (localStorage.getItem(NOTIF_DISMISSED_KEY)) return;
		const t = setTimeout(() => setShowNotifPrompt(true), 12000);
		return () => clearTimeout(t); //incase of unmount clear timer
	}, []);

	function dismissNotifPrompt() {
		localStorage.setItem(NOTIF_DISMISSED_KEY, '1');
		setShowNotifPrompt(false);
	}

	function disableNotifsPrompts() {
		setShowNotifPrompt(false);
	}

	const ytCount = queue.filter((i) => i.type === 'youtube').length;
	const artCount = queue.filter((i) => i.type === 'article').length;
	const pdfCount = queue.filter((i) => i.type === 'pdf').length;

	function addYoutube() {
		const url = youtubeInput.trim();
		if (!url || ytCount >= YOUTUBE_LIMIT) return;
		setQueue((q) => [...q, { id: crypto.randomUUID(), type: 'youtube', url }]);
		setYoutubeInput('');
	}

	function addArticle() {
		const url = articleInput.trim();
		if (!url || artCount >= ARTICLE_LIMIT) return;
		setQueue((q) => [...q, { id: crypto.randomUUID(), type: 'article', url }]);
		setArticleInput('');
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
		stopPollingRef.current?.();
		stopPollingRef.current = null;
		setView('entry');
		setStatus(null);
	}

	async function handleSubmit() {
		if (!queue.length || isLoading) return;
		setIsLoading(true);
		setStatus(null);
		const queuedStatuses = getQueueSourceStatuses(queue);
		setActiveJob(null);
		setSourceStatuses(queuedStatuses);
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

			const { job } = await submitIntake({
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

			const firstStatuses = getSourceStatuses(
				job,
				new Map(
					queuedStatuses.map((sourceStatus) => [
						sourceStatus.sourceId,
						sourceStatus,
					]),
				),
			);

			setActiveJob(job);
			setSourceStatuses(firstStatuses);
			setStatus('Processing...');
			stopPollingRef.current?.();
			stopPollingRef.current = pollJobSourceStatuses(job.id, (statuses, nextJob) => {
				setSourceStatuses(statuses);
				setActiveJob(nextJob);

				if (
					statuses.every(
						(sourceStatus) =>
							sourceStatus.extractionStatus === 'text-retrieved' ||
							sourceStatus.extractionStatus === 'failed',
					)
				) {
					setStatus('Text retrieval finished.');
				}
			});
		} catch {
			setStatus('Something went wrong. Please try again.');
			setSourceStatuses((current) =>
				current.map((sourceStatus) => ({
					...sourceStatus,
					status: 'failed',
					message: 'Could not submit source',
					changed: true,
				})),
			);
		} finally {
			setIsLoading(false);
		}
	}

	async function sendNotifications() {
		return;
	}

	const visibleSourceStatuses =
		sourceStatuses.length > 0 ? sourceStatuses : getQueueSourceStatuses(queue);

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
							view === 'processing' ? '-translate-x-1/2' : 'translate-x-0'
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

						<ProcessingView
							backToEntry={backToEntry}
							activeJob={activeJob}
							visibleSourceStatuses={visibleSourceStatuses}
							status={status}
						/>
					</div>
				</section>
			</main>
		</>
	);
}

export default App;
