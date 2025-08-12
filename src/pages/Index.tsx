import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "@/components/search/SearchBar";
import SearchResults, { type ResultItem } from "@/components/search/SearchResults";
import { toast } from "@/hooks/use-toast";

function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function decodeDuckUrl(href: string): string {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
  } catch (_) {}
  return href;
}

function scoreResult(q: string, title: string, snippet: string, url: string): number {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const t = title.toLowerCase();
  const s = snippet.toLowerCase();
  const u = url.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (t.includes(term)) score += 3;
    if (s.includes(term)) score += 1.5;
    if (u.includes(term)) score += 0.5;
  }
  if (/\.edu\b|\.gov\b/.test(u)) score += 2.5;
  if (/\.org\b/.test(u)) score += 1;
  if (u.startsWith("https://")) score += 0.5;
  return score;
}

const Index = () => {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);

  const runSearch = async (q: string) => {
    try {
      setLoading(true);
      const url = `https://r.jina.ai/http://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
      const resp = await fetch(url, { headers: { "Accept": "text/html" } });
      const html = await resp.text();

      const parsed: ResultItem[] = [];
      const blocks = html.split('<div class="result');
      for (const block of blocks) {
        const aMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!aMatch) continue;
        const hrefRaw = aMatch[1];
        const titleHtml = aMatch[2];
        const urlResolved = decodeDuckUrl(hrefRaw);
        const title = stripTags(titleHtml);
        const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const snippet = stripTags(snippetMatch?.[1] || (snippetMatch as any)?.[2] || "");
        const score = scoreResult(q, title, snippet, urlResolved);
        parsed.push({ title, url: urlResolved, snippet, score });
      }

      if (parsed.length === 0) {
        const re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(html)) !== null) {
          const urlResolved = decodeDuckUrl(m[1]);
          const title = stripTags(m[2]);
          parsed.push({ title, url: urlResolved, snippet: "" });
        }
      }

      parsed.sort((a, b) => (b.score || 0) - (a.score || 0));
      setResults(parsed);
      if (!parsed.length) {
        toast({ title: "No results", description: "Try different keywords." });
      }
    } catch (e: any) {
      toast({ title: "Search failed", description: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q) runSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("q")]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b">
        <div className="container mx-auto py-4">
          <h1 className="text-xl font-semibold">Essence Search</h1>
        </div>
      </header>
      <main>
        <section className="container mx-auto py-12">
          <div className="text-center mb-8">
            <h2 className="sr-only">Fast, minimal web search</h2>
            <p className="text-muted-foreground">Type your query and press Enter</p>
          </div>
          <SearchBar onSearch={runSearch} loading={loading} />
          <div className="mt-8">
            <SearchResults results={results} loading={loading} />
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
