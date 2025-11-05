export interface BlogSearchResult {
    title: string;
    url: string;
    description: string;
    author: string;
    date: string;
    platform: string;
}

export interface BlogSearchDebugInfo {
    containerSelectors: {
        selector: string;
        found: boolean;
        count: number;
    }[];
    pageTitle: string;
    url: string;
    bodyContent: string;
    sampleHTML: string;
}

export interface BlogSearchEvaluateResult {
    results: BlogSearchResult[];
    debugInfo: BlogSearchDebugInfo;
}
