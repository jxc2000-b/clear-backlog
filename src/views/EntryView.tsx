import { useState } from 'react';
import type { QueueItem } from '../types';
import {
	ARTICLE_LIMIT,
	PDF_LIMIT,
	YOUTUBE_LIMIT,
} from '../constants';

function QueueRow({
	item,
	onRemove,
}: {
	item: QueueItem;
	onRemove: () => void;
}) {
	const badge =
		item.type === 'youtube' ? '‎ ▶‎' : item.type === 'article' ? 'URL' : '📄';
	const label = item.type === 'pdf' ? item.file.name : item.url;
	const badgeCss =
		item.type === 'youtube'
			? 'bg-red-500 rounded-sm'
			: item.type === 'article'
				? 'bg-gray-500'
				: 'text-[16px]';

	return (
		<li className="flex items-center gap-3 border border-black bg-white px-4 py-2.5">
			<span
				className={`shrink-0 ${badgeCss} px-1.5 py-0.5 text-[10px] font-bold uppercase text-white`}
			>
				{badge}
			</span>
			<span className="flex-1 truncate text-sm text-black ">{label}</span>
			<button
				onClick={onRemove}
				aria-label="Remove"
				className="shrink-0 text-xl leading-none text-gray-300 hover:text-black"
			>
				×
			</button>
		</li>
	);
}

function Spinner() {
	return (
		<svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
			/>
		</svg>
	);
}

type EntryViewProps = {
	queue: QueueItem[];
	isLoading: boolean;
	ytCount: number;
	artCount: number;
	pdfCount: number;
	youtubeInput: string;
	setYoutubeInput: (value: string) => void;
	articleInput: string;
	setArticleInput: (value: string) => void;
	addYoutube: () => string | null;
	addArticle: () => string | null;
	addPdfs: (files: FileList | null) => void;
	remove: (id: string) => void;
	handleSubmit: () => void;
};

function EntryView({
	queue,
	isLoading,
	ytCount,
	artCount,
	pdfCount,
	youtubeInput,
	setYoutubeInput,
	articleInput,
	setArticleInput,
	addYoutube,
	addArticle,
	addPdfs,
	remove,
	handleSubmit,
}: EntryViewProps) {
	const addBtn =
		'shrink-0 bg-black px-3 py-1 text-xs font-semibold text-white transition hover:bg-gray-700';
	const [youtubeMsg, setYoutubeMsg] = useState<string | null>(null);
	const [articleMsg, setArticleMsg] = useState<string | null>(null);

	return (
		<div className="w-1/2 shrink-0">
			<div className="mb-8">
				<h1 className="text-2xl font-semibold leading-snug">
					Clear your annoying backlog of youtube videos, bookmarks, unread
					articles and pdfs by consuming them in small bite-sized stories delivered by
					notifications
				</h1>
				<p className="mt-2 text-sm text-gray-500">
					Add sources below: videos, articles, or PDFs.
				</p>
			</div>

			<form onSubmit={(e) => e.preventDefault()} className="space-y-3">
				{/* YouTube */}
				<label className="block border border-black px-4 py-3 transition hover:border-red-400 hover:shadow-[0_0_0_3px_rgba(248,113,113,0.15)] focus-within:border-red-400 focus-within:shadow-[0_0_0_3px_rgba(248,113,113,0.15)]">
					<span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
						YouTube (video links only) · {ytCount}/{YOUTUBE_LIMIT}
					</span>
					<div className="flex items-center gap-2">
						<input
							type="url"
							value={youtubeInput}
							onChange={(e) => setYoutubeInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									setYoutubeMsg(addYoutube());
								}
							}}
							placeholder="https://youtube.com/watch?v=…"
							className="flex-1 border-0 bg-transparent text-sm text-black outline-none placeholder:text-gray-300 disabled:cursor-not-allowed"
						/>
						{youtubeInput.trim() && ytCount < YOUTUBE_LIMIT && (
							<button
								type="button"
								onClick={() => setYoutubeMsg(addYoutube())}
								className={addBtn}
							>
								+ Add
							</button>
						)}
					</div>
					{youtubeMsg && (
						<p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-500">
							{youtubeMsg}
						</p>
					)}
				</label>

				{/* Article */}
				<label className="block border border-black px-4 py-3 transition hover:border-slate-400 hover:shadow-[0_0_0_3px_rgba(148,163,184,0.2)] focus-within:border-slate-700 focus-within:shadow-[0_0_0_3px_rgba(148,163,184,0.2)]">
					<span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
						Article · {artCount}/{ARTICLE_LIMIT}
					</span>
					<div className="flex items-center gap-2">
						<input
							type="url"
							value={articleInput}
							onChange={(e) => setArticleInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									setArticleMsg(addArticle());
								}
							}}
							placeholder="https://example.com/article…"
							className="flex-1 border-0 bg-transparent text-sm text-black outline-none placeholder:text-gray-300 disabled:cursor-not-allowed"
						/>
						{articleInput.trim() && artCount < ARTICLE_LIMIT && (
							<button
								type="button"
								onClick={() => setArticleMsg(addArticle())}
								className={addBtn}
							>
								+ Add
							</button>
						)}
					</div>
					{articleMsg && (
						<p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-500">
							{articleMsg}
						</p>
					)}
				</label>

				{/* PDF */}
				<label
					className={`block border border-dashed border-green-400 px-4 py-3 transition ${
						pdfCount < PDF_LIMIT
							? 'cursor-pointer hover:border-green-600 hover:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]'
							: 'cursor-not-allowed opacity-50'
					}`}
				>
					<span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
						PDF · {pdfCount}/{PDF_LIMIT}
					</span>
					<input
						type="file"
						accept="application/pdf"
						multiple
						onChange={(e) => addPdfs(e.target.files)}
						disabled={pdfCount >= PDF_LIMIT}
						className="sr-only"
					/>
					<span className="text-sm text-gray-400">
						{pdfCount >= PDF_LIMIT
							? 'Limit reached'
							: 'Choose PDF files · max 3 MB each'}
					</span>
				</label>
			</form>

			{/* Queue */}
			{queue.length > 0 && (
				<div className="mt-8">
					<p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
						Queue · {queue.length} source
						{queue.length !== 1 ? 's' : ''}
					</p>
					<ul className="space-y-1.5">
						{queue.map((item) => (
							<QueueRow
								key={item.id}
								item={item}
								onRemove={() => remove(item.id)}
							/>
						))}
					</ul>

					<button
						onClick={handleSubmit}
						disabled={isLoading}
						className="mt-5 flex w-full items-center justify-center gap-2 bg-black py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
					>
						{isLoading ? (
							<>
								<Spinner /> Processing…
							</>
						) : (
							'Submit'
						)}
					</button>
				</div>
			)}
		</div>
	);
}

export default EntryView;
