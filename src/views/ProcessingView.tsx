import type { BackendJob, SourceStatus } from '../types';

function SourceStatusRow({ item }: { item: SourceStatus }) {
	const statusCss =
		item.extractionStatus === 'text-retrieved'
			? 'text-green-700'
			: item.extractionStatus === 'failed'
				? 'text-red-600'
				: 'text-gray-500';

	return (
		<li className="border border-gray-200 bg-white px-4 py-3">
			<div className="flex items-center justify-between gap-3">
				<span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
					{item.type}
				</span>
				<span className={`shrink-0 text-xs font-semibold ${statusCss}`}>
					{item.message}
				</span>
			</div>
			<p className="mt-1 truncate text-sm text-black">{item.source}</p>
			{typeof item.textLength === 'number' && (
				<p className="mt-1 text-xs text-gray-400">
					{item.textLength.toLocaleString()} characters retrieved
				</p>
			)}
		</li>
	);
}

type ProcessingViewProps = {
	backToEntry: () => void;
	activeJob: BackendJob | null;
	visibleSourceStatuses: SourceStatus[];
	status: string | null;
};

function ProcessingView({
	backToEntry,
	activeJob,
	visibleSourceStatuses,
	status,
}: ProcessingViewProps) {
	return (
		<div className="w-1/2 shrink-0 pl-8">
			<button
				type="button"
				onClick={backToEntry}
				className="mb-8 text-sm font-semibold text-gray-500 transition hover:text-black"
			>
				← Back
			</button>

			<div className="mb-6">
				<h2 className="mt-1 text-2xl font-semibold leading-snug">
					Queued sources
				</h2>
				<p className="mt-2 text-sm text-gray-500">
					{activeJob
						? `Job ${activeJob.id.slice(0, 8)} is ${activeJob.status}.`
						: 'Waiting for the backend to accept the job.'}
				</p>
			</div>

			<ul className="space-y-2">
				{visibleSourceStatuses.map((sourceStatus) => (
					<SourceStatusRow
						key={sourceStatus.sourceId}
						item={sourceStatus}
					/>
				))}
			</ul>

			{status && (
				<p className="mt-5 text-center text-sm text-gray-500">
					{status}
				</p>
			)}
		</div>
	);
}

export default ProcessingView;
