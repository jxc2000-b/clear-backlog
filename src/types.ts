export type QueueItem =
    | { id: string; type: 'youtube'; url: string }
    | { id: string; type: 'article'; url: string }
    | { id: string; type: 'pdf'; file: File };

export type SourceType = 'youtube' | 'article' | 'pdf';

export type GeneratedByte = {
    sourceId: string;
    type: SourceType;
    source: string;
    index: number;
    speaker: string;
    quote: string;
    commentary: string;
    text: string;
};

export type ByteGenerationResult = {
    sourceId: string;
    type: SourceType;
    source: string;
    model: string;
    bytes: GeneratedByte[];
};

export type ByteGenerationError = {
    sourceId?: string;
    type?: SourceType;
    source?: string;
    message: string;
    code: string;
    statusCode: number;
};

export type JobGeneration = {
    status:
        | 'running'
        | 'generated'
        | 'generated_with_errors'
        | 'generation_failed'
        | 'failed'
        | 'skipped';
    startedAt?: string;
    completedAt?: string;
    sourceCount?: number;
    completedCount?: number;
    results: ByteGenerationResult[];
    errors: ByteGenerationError[];
};

export type BackendJob = {
    id: string;
    status: string;
    sources: {
        youtubePlaylistUrl: string | null;
        youtubeVideoUrls: string[];
        articleUrls: string[];
        pdfs: { name?: string }[];
    };
    extraction?: {
        status: string;
        results: {
            sourceId: string;
            type: 'youtube' | 'article' | 'pdf';
            source: string;
            length: number;
        }[];
        errors: {
            sourceId: string;
            type: 'youtube' | 'article' | 'pdf' | 'youtube-playlist';
            source: string;
            message: string;
        }[];
    };
    generation?: JobGeneration;
};

export type SourceStatus = {
    sourceId: string;
    type: 'youtube' | 'article' | 'pdf' | 'youtube-playlist';
    source: string;

    extractionStatus: 'queued' | 'extracting' | 'text-retrieved' | 'failed';
    generationStatus?: 'waiting' | 'generating' | 'generated' | 'failed';

    message: string;
    changed: boolean;
    textLength?: number;
};

// ── Supabase row shapes (snake_case to match the database columns) ──────────
// These mirror the backend's `JobRow`/`SourceRow`/`ByteRow` types and are what
// supabase-js returns from `.select('*')` against jobs/sources/bytes tables.

export type JobRow = {
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
    pipeline: string[];
    pipeline_stage: string | null;
    limits: Record<string, unknown>;
    prompts: Record<string, unknown>;
    error: string | null;
};

export type SourceRow = {
    id: string;
    job_id: string;
    source_id: string;                   // logical id like 'youtube:0'
    type: SourceType;
    source: string;
    extraction_status: 'queued' | 'extracting' | 'text-retrieved' | 'failed';
    generation_status: 'waiting' | 'generating' | 'generated' | 'failed';
    message: string | null;
    text: string | null;
    text_length: number | null;
    error: string | null;
    created_at: string;
    updated_at: string;
};

export type ByteRow = {
    id: string;
    job_id: string;
    source_id: string;                   // sources.id (uuid), not the logical id
    index: number;
    speaker: string | null;
    quote: string | null;
    commentary: string | null;
    text: string | null;
    created_at: string;
};
