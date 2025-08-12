// Supabase Edge Function: search
// Scrapes DuckDuckGo Lite HTML and returns a simple list of results ranked by a simple relevance score

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function decodeDuckUrl(href: string): string {
  try {
    // DuckDuckGo sometimes wraps links like /l/?kh=-1&uddg=https%3A%2F%2Fexample.com
    const url = new URL(href, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
  } catch (_) {
    // ignore
  }
  return href;
}

function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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
  // lightweight domain authority heuristic
  if (/\.edu\b|\.gov\b/.test(u)) score += 2.5;
  if (/\.org\b/.test(u)) score += 1;

  // prefer https
  if (u.startsWith("https://")) score += 0.5;

  return score;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { q } = await req.json();
    if (!q || typeof q !== "string") {
      return new Response(JSON.stringify({ error: "Missing query 'q'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      },
    });

    const html = await resp.text();

    // Very simple parsing of result blocks
    const results: Array<{ title: string; url: string; snippet: string; score: number }> = [];

    // Split by result blocks to make snippet extraction easier
    const blocks = html.split('<div class="result');
    for (const block of blocks) {
      const aMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!aMatch) continue;
      const hrefRaw = aMatch[1];
      const titleHtml = aMatch[2];

      const urlResolved = decodeDuckUrl(hrefRaw);
      const title = stripTags(titleHtml);

      // snippet can be inside result__snippet or result__snippet js-result-snippet
      const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const snippet = stripTags(snippetMatch?.[1] || snippetMatch?.[2] || "");

      const score = scoreResult(q, title, snippet, urlResolved);

      results.push({ title, url: urlResolved, snippet, score });
    }

    // Fallback: try anchors even if blocks failed
    if (results.length === 0) {
      const re = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = re.exec(html)) !== null) {
        const urlResolved = decodeDuckUrl(m[1]);
        const title = stripTags(m[2]);
        const snippet = "";
        const score = scoreResult(q, title, snippet, urlResolved);
        results.push({ title, url: urlResolved, snippet, score });
      }
    }

    // Rank by score desc
    results.sort((a, b) => b.score - a.score);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
