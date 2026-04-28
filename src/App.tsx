import { useEffect, useState } from 'react';

type QueueItem =
  | { id: string; type: 'youtube'; url: string }
  | { id: string; type: 'article'; url: string }
  | { id: string; type: 'pdf'; file: File };

const YOUTUBE_LIMIT = 10;
const ARTICLE_LIMIT = 10;
const PDF_LIMIT = 2;
const PDF_MAX_BYTES = 3 * 1024 * 1024;
const NOTIF_DISMISSED_KEY = 'cb-notif-dismissed';

function NotificationPrompt({ onDismiss }: { onDismiss: () => void }) {
  async function allow() {
    await Notification.requestPermission();
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm border border-gray-200 bg-white px-6 py-6 shadow-lg">
        <p className="mb-1 text-base font-semibold text-black">Enable notifications</p>
        <p className="mb-5 text-sm text-gray-500">
          Get notified when your bytes are ready to read.
        </p>
        <div className="flex gap-3">
          <button
            onClick={allow}
            className="bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Allow
          </button>
          <button
            onClick={onDismiss}
            className="px-5 py-2 text-sm text-gray-500 transition hover:text-black"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function QueueRow({ item, onRemove }: { item: QueueItem; onRemove: () => void }) {
  const badge = item.type === 'youtube' ? 'YT' : item.type === 'article' ? 'URL' : 'PDF';
  const label = item.type === 'pdf' ? item.file.name : item.url;

  return (
    <li className="flex items-center gap-3 border border-gray-200 bg-white px-4 py-2.5">
      <span className="shrink-0 bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-500">
        {badge}
      </span>
      <span className="flex-1 truncate text-sm text-black">{label}</span>
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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function App() {
  const [youtubeInput, setYoutubeInput] = useState('');
  const [articleInput, setArticleInput] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(NOTIF_DISMISSED_KEY)) return;
    const t = setTimeout(() => setShowNotifPrompt(true), 1200);
    return () => clearTimeout(t);
  }, []);

  function dismissNotifPrompt() {
    localStorage.setItem(NOTIF_DISMISSED_KEY, '1');
    setShowNotifPrompt(false);
  }

  const ytCount = queue.filter(i => i.type === 'youtube').length;
  const artCount = queue.filter(i => i.type === 'article').length;
  const pdfCount = queue.filter(i => i.type === 'pdf').length;

  function addYoutube() {
    const url = youtubeInput.trim();
    if (!url || ytCount >= YOUTUBE_LIMIT) return;
    setQueue(q => [...q, { id: crypto.randomUUID(), type: 'youtube', url }]);
    setYoutubeInput('');
  }

  function addArticle() {
    const url = articleInput.trim();
    if (!url || artCount >= ARTICLE_LIMIT) return;
    setQueue(q => [...q, { id: crypto.randomUUID(), type: 'article', url }]);
    setArticleInput('');
  }

  function addPdfs(files: FileList | null) {
    if (!files) return;
    const remaining = PDF_LIMIT - pdfCount;
    const valid = Array.from(files).filter(f => f.size <= PDF_MAX_BYTES).slice(0, remaining);
    if (valid.length) {
      setQueue(q => [...q, ...valid.map(file => ({ id: crypto.randomUUID(), type: 'pdf' as const, file }))]);
    }
  }

  function remove(id: string) {
    setQueue(q => q.filter(i => i.id !== id));
  }

  async function handleSubmit() {
    if (!queue.length || isLoading) return;
    setIsLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube: queue
            .filter((i): i is Extract<QueueItem, { type: 'youtube' }> => i.type === 'youtube')
            .map(i => i.url),
          articles: queue
            .filter((i): i is Extract<QueueItem, { type: 'article' }> => i.type === 'article')
            .map(i => i.url),
        }),
      });
      const data = await res.json() as { jobId?: string; message?: string };
      setStatus(data.jobId ? `Queued — job ${data.jobId}` : (data.message ?? 'Submitted.'));
      setQueue([]);
    } catch {
      setStatus('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const addBtn = 'shrink-0 bg-black px-3 py-1 text-xs font-semibold text-white transition hover:bg-gray-700';

  return (
    <>
      {showNotifPrompt && <NotificationPrompt onDismiss={dismissNotifPrompt} />}

      <main className="min-h-screen bg-white px-6 py-10 font-serif text-black">
        <header className="mb-14">
          <p className="text-sm font-semibold">Clear Backlog</p>
        </header>

        <section className="mx-auto max-w-xl">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold leading-snug">
              Clear your backlog.
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Add sources below — videos, articles, or PDFs.
            </p>
          </div>

          <form onSubmit={e => e.preventDefault()} className="space-y-3">
            {/* YouTube */}
            <label className="block border border-gray-200 px-4 py-3 transition hover:border-red-400 hover:shadow-[0_0_0_3px_rgba(248,113,113,0.15)] focus-within:border-red-400 focus-within:shadow-[0_0_0_3px_rgba(248,113,113,0.15)]">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                YouTube · {ytCount}/{YOUTUBE_LIMIT}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={youtubeInput}
                  onChange={e => setYoutubeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addYoutube(); } }}
                  placeholder="https://youtube.com/watch?v=…"
                  disabled={ytCount >= YOUTUBE_LIMIT}
                  className="flex-1 border-0 bg-transparent text-sm text-black outline-none placeholder:text-gray-300 disabled:cursor-not-allowed"
                />
                {youtubeInput.trim() && ytCount < YOUTUBE_LIMIT && (
                  <button type="button" onClick={addYoutube} className={addBtn}>
                    + Add
                  </button>
                )}
              </div>
            </label>

            {/* Article */}
            <label className="block border border-gray-200 px-4 py-3 transition hover:border-slate-400 hover:shadow-[0_0_0_3px_rgba(148,163,184,0.2)] focus-within:border-slate-400 focus-within:shadow-[0_0_0_3px_rgba(148,163,184,0.2)]">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Article · {artCount}/{ARTICLE_LIMIT}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={articleInput}
                  onChange={e => setArticleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addArticle(); } }}
                  placeholder="https://example.com/article…"
                  disabled={artCount >= ARTICLE_LIMIT}
                  className="flex-1 border-0 bg-transparent text-sm text-black outline-none placeholder:text-gray-300 disabled:cursor-not-allowed"
                />
                {articleInput.trim() && artCount < ARTICLE_LIMIT && (
                  <button type="button" onClick={addArticle} className={addBtn}>
                    + Add
                  </button>
                )}
              </div>
            </label>

            {/* PDF */}
            <label
              className={`block border border-dashed border-green-400 px-4 py-3 transition ${pdfCount < PDF_LIMIT ? 'cursor-pointer hover:border-green-600 hover:shadow-[0_0_0_3px_rgba(74,222,128,0.15)]' : 'cursor-not-allowed opacity-50'}`}
            >
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                PDF · {pdfCount}/{PDF_LIMIT}
              </span>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={e => addPdfs(e.target.files)}
                disabled={pdfCount >= PDF_LIMIT}
                className="sr-only"
              />
              <span className="text-sm text-gray-400">
                {pdfCount >= PDF_LIMIT ? 'Limit reached' : 'Choose PDF files · max 3 MB each'}
              </span>
            </label>
          </form>

          {/* Queue */}
          {queue.length > 0 && (
            <div className="mt-8">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Queue · {queue.length} source{queue.length !== 1 ? 's' : ''}
              </p>
              <ul className="space-y-1.5">
                {queue.map(item => (
                  <QueueRow key={item.id} item={item} onRemove={() => remove(item.id)} />
                ))}
              </ul>

              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="mt-5 flex w-full items-center justify-center gap-2 bg-black py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-400"
              >
                {isLoading ? <><Spinner /> Processing…</> : 'Clear the backlog'}
              </button>
            </div>
          )}

          {status && (
            <p className="mt-5 text-center text-sm text-gray-500">{status}</p>
          )}
        </section>
      </main>
    </>
  );
}

export default App;
