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
      let parsed: ResultItem[] = [];

      // Primary: Supabase Edge Function
      try {
        const resp = await fetch("/functions/v1/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q }),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(text || `Request failed: ${resp.status}`);
        }

        const data = await resp.json();
        parsed = (data?.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          score: r.score,
        }));
      } catch (_) {
        // fall back below
      }

      // Fallback: r.jina.ai Markdown proxy if Edge Function fails or returns nothing
      if (!parsed.length) {
        const url = `https://r.jina.ai/http://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const mdResp = await fetch(url, { headers: { Accept: "text/markdown" } });
        const md = await mdResp.text();

        const results: ResultItem[] = [];

        // First pass: DuckDuckGo redirect links that wrap real URLs
        const re1 = /\[([^\]]+)\]\((https?:\/\/duckduckgo\.com\/l\/\?[^)]+)\)/g;
        let m1: RegExpExecArray | null;
        while ((m1 = re1.exec(md)) !== null) {
          const title = stripTags(m1[1]);
          try {
            const u = new URL(m1[2]);
            const uddg = u.searchParams.get("uddg");
            const finalUrl = uddg ? decodeURIComponent(uddg) : m1[2];
            results.push({ title, url: finalUrl, snippet: "" });
          } catch {
            results.push({ title, url: m1[2], snippet: "" });
          }
        }

        // Second pass: generic markdown links (skip images and DDG assets)
        const lines = md.split("\n");
        for (const line of lines) {
          const l = line.trim();
          if (!l || l.startsWith("![")) continue;
          const m = l.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
          if (!m) continue;
          const title = stripTags(m[1]);
          const url = m[2];
          if (/duckduckgo\.com\/html|i\.duckduckgo\.com|external-content\.duckduckgo\.com/.test(url)) continue;
          if (!results.some((r) => r.url === url)) {
            results.push({ title, url, snippet: "" });
          }
        }

        parsed = results;
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
