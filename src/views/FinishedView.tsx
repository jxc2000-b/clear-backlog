import type { BackendJob, ByteGenerationResult, GeneratedByte } from '../types';

function typeBadge(type: GeneratedByte['type']) {
	if (type === 'youtube') return { label: '‎ ▶‎', css: 'bg-red-500 rounded-sm text-white' };
	if (type === 'article') return { label: 'URL', css: 'bg-gray-500 text-white' };
	return { label: '📄', css: 'text-[16px]' };
}

function ByteCard({ byte }: { byte: GeneratedByte }) {
	return (
		<li className="border border-gray-200 bg-white px-4 py-3">
			<div className="flex items-center justify-between gap-3">
				<span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
					Byte {byte.index + 1}
				</span>
				<span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">
					{byte.speaker}
				</span>
			</div>
			<p className="mt-2 border-l-2 border-black pl-3 text-sm italic text-black">
				“{byte.quote}”
			</p>
			<p className="mt-2 text-sm text-gray-600">{byte.commentary}</p>
			<a href = {byte.source} className="mt-2 text-sm text-gray-600 underline decoration-dotted">{byte.source}</a>
		</li>
	);
}

function SourceBytesGroup({ result }: { result: ByteGenerationResult }) {
	const badge = typeBadge(result.type);

	return (
		<section className="space-y-2">
			<div className="flex items-center gap-3 border border-black bg-white px-4 py-2.5">
				<span
					className={`shrink-0 ${badge.css} px-1.5 py-0.5 text-[10px] font-bold uppercase`}
				>
					{badge.label}
				</span>
				<span className="flex-1 truncate text-sm text-black">{result.source}</span>
				<span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">
					{result.bytes.length} byte{result.bytes.length !== 1 ? 's' : ''}
				</span>
			</div>
			<ul className="space-y-1.5">
				{result.bytes.map((byte) => (
					<ByteCard key={`${byte.sourceId}:${byte.index}`} byte={byte} />
				))}
			</ul>
		</section>
	);
}

type FinishedViewProps = {
	backToEntry: () => void;
	completedJob: BackendJob;
	bytes: GeneratedByte[];
};

function FinishedView({ backToEntry, completedJob, bytes }: FinishedViewProps) {
	const generation = completedJob.generation;
	const results = generation?.results ?? [];
	const errors = generation?.errors ?? [];

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
				<span className="text-[10px] font-bold uppercase tracking-widest text-green-600">
					Done
				</span>
				<h2 className="mt-1 text-2xl font-semibold leading-snug">
					Your bytes are ready
				</h2>
				<p className="mt-2 text-sm text-gray-500">
					Job {completedJob.id.slice(0, 8)} produced {bytes.length} byte
					{bytes.length !== 1 ? 's' : ''} across {results.length} source
					{results.length !== 1 ? 's' : ''}.
				</p>
			</div>

			<div className="space-y-6">
				{results.map((result) => (
					<SourceBytesGroup key={result.sourceId} result={result} />
				))}
			</div>

			{errors.length > 0 && (
				<div className="mt-8">
					<p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-red-500">
						{errors.length} source{errors.length !== 1 ? 's' : ''} failed
					</p>
					<ul className="space-y-1.5">
						{errors.map((error, index) => (
							<li
								key={`${error.sourceId ?? 'error'}:${index}`}
								className="border border-red-200 bg-white px-4 py-3"
							>
								<div className="flex items-center justify-between gap-3">
									<span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
										{error.type ?? 'unknown'}
									</span>
									<span className="shrink-0 text-xs font-semibold text-red-600">
										{error.code}
									</span>
								</div>
								{error.source && (
									<p className="mt-1 truncate text-sm text-black">{error.source}</p>
								)}
								<p className="mt-1 text-xs text-gray-500">{error.message}</p>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

export default FinishedView;
