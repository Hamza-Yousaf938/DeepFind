import { cn } from "@/lib/utils";

export interface ResultItem {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

interface SearchResultsProps {
  results: ResultItem[];
  loading?: boolean;
}

const SkeletonLine = () => (
  <div className="animate-pulse rounded-md bg-muted h-4" />
);

const ResultCardSkeleton = () => (
  <li className="rounded-lg border p-4 space-y-2">
    <SkeletonLine />
    <SkeletonLine />
    <div className="h-3" />
    <SkeletonLine />
  </li>
);

const SearchResults = ({ results, loading }: SearchResultsProps) => {
  if (loading) {
    return (
      <ul className="space-y-4" aria-busy>
        {Array.from({ length: 6 }).map((_, i) => (
          <ResultCardSkeleton key={i} />
        ))}
      </ul>
    );
  }

  if (!results?.length) {
    return (
      <div className="text-center text-muted-foreground" role="status">
        No results yet. Try a different query.
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {results.map((r, i) => {
        const host = (() => {
          try {
            return new URL(r.url).hostname;
          } catch {
            return r.url;
          }
        })();
        return (
          <li key={`${r.url}-${i}`} className={cn("rounded-lg border p-4 group")}> 
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              <div className="text-sm text-muted-foreground">{host}</div>
              <h3 className="text-lg font-medium underline-offset-2 group-hover:underline">
                {r.title}
              </h3>
              {r.snippet && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.snippet}</p>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
};

export default SearchResults;
