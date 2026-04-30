export type QueueItem =
    | { id: string; type: 'youtube'; url: string }
    | { id: string; type: 'article'; url: string }
    | { id: string; type: 'pdf'; file: File };

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