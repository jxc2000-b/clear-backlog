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
