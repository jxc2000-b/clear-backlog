import type { ByteRow, JobRow, SourceRow, SourceType } from '../types';

function typeBadge(type: SourceType) {
	if (type === 'youtube') return { label: '‎ ▶‎', css: 'bg-red-500 rounded-sm text-white' };
	if (type === 'article') return { label: 'URL', css: 'bg-gray-500 text-white' };
	return { label: '📄', css: 'text-[16px]' };
}

function ByteCard({ byte, sourceUrl }: { byte: ByteRow; sourceUrl: string }) {
	return (
		<li className="border border-gray-200 bg-white px-4 py-3">
			<div className="flex items-center justify-between gap-3">
				<span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
					Byte {byte.index + 1}
				</span>
				<span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">
					{byte.speaker ?? 'Unknown'}
				</span>
			</div>
			<p className="mt-2 border-l-2 border-black pl-3 text-sm italic text-black">
				“{byte.quote ?? ''}”
			</p>
			<p className="mt-2 text-sm text-gray-600">{byte.commentary ?? ''}</p>
			<a href={sourceUrl} className="mt-2 text-sm text-gray-600 underline decoration-dotted">
				{sourceUrl}
			</a>
		</li>
	);
}

// One section per source that produced bytes. Renders a header card with
// the type badge + source URL + byte count, then the bytes themselves.
function SourceBytesGroup({ source, bytes }: { source: SourceRow; bytes: ByteRow[] }) {
	const badge = typeBadge(source.type);

	return (
		<section className="space-y-2">
			<div className="flex items-center gap-3 border border-black bg-white px-4 py-2.5">
				<span
					className={`shrink-0 ${badge.css} px-1.5 py-0.5 text-[10px] font-bold uppercase`}
				>
					{badge.label}
				</span>
				<span className="flex-1 truncate text-sm text-black">{source.source}</span>
				<span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">
					{bytes.length} byte{bytes.length !== 1 ? 's' : ''}
				</span>
			</div>
			<ul className="space-y-1.5">
				{bytes.map((byte) => (
					<ByteCard
						key={`${byte.source_id}:${byte.index}`}
						byte={byte}
						sourceUrl={source.source}
					/>
				))}
			</ul>
		</section>
	);
}

type FinishedViewProps = {
	backToEntry: () => void;
	job: JobRow;
	sources: SourceRow[];
	bytes: ByteRow[];
};

function FinishedView({ backToEntry, job, sources, bytes }: FinishedViewProps) {
	// Group bytes by their source uuid (bytes.source_id FKs to sources.id).
	const bytesBySource = new Map<string, ByteRow[]>();
	for (const byte of bytes) {
		const existing = bytesBySource.get(byte.source_id) ?? [];
		existing.push(byte);
		bytesBySource.set(byte.source_id, existing);
	}

	// Sources that successfully produced at least one byte — these get rendered
	// as expandable groups. Pair them with the source row so we can show the
	// type/URL/title alongside.
	const completedSources = sources.filter((source) => bytesBySource.has(source.id));

	// Sources that failed somewhere in the pipeline — surfaced in the error
	// section at the bottom so the user knows nothing was generated for them.
	const failedSources = sources.filter(
		(source) => source.extraction_status === 'failed' || source.generation_status === 'failed',
	);

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
					Job {job.id.slice(0, 8)} produced {bytes.length} byte
					{bytes.length !== 1 ? 's' : ''} across {completedSources.length} source
					{completedSources.length !== 1 ? 's' : ''}.
				</p>
			</div>

			<div className="space-y-6">
				{completedSources.map((source) => (
					<SourceBytesGroup
						key={source.id}
						source={source}
						bytes={bytesBySource.get(source.id) ?? []}
					/>
				))}
			</div>

			{failedSources.length > 0 && (
				<div className="mt-8">
					<p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-red-500">
						{failedSources.length} source{failedSources.length !== 1 ? 's' : ''} failed
					</p>
					<ul className="space-y-1.5">
						{failedSources.map((source) => (
							<li
								key={source.id}
								className="border border-red-200 bg-white px-4 py-3"
							>
								<div className="flex items-center justify-between gap-3">
									<span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
										{source.type}
									</span>
									<span className="shrink-0 text-xs font-semibold text-red-600">
										{source.extraction_status === 'failed' ? 'extraction' : 'generation'}
									</span>
								</div>
								<p className="mt-1 truncate text-sm text-black">{source.source}</p>
								<p className="mt-1 text-xs text-gray-500">
									{source.error ?? source.message ?? 'Unknown error'}
								</p>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

export default FinishedView;
