import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "react-router-dom";

interface SearchBarProps {
  onSearch: (q: string) => void;
  loading?: boolean;
}

const SearchBar = ({ onSearch, loading }: SearchBarProps) => {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");

  useEffect(() => {
    const q = params.get("q") || "";
    setQuery(q);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("q")]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setParams({ q });
    onSearch(q);
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Search" className="w-full max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the web..."
          aria-label="Search query"
          className="flex-1 h-12 text-base"
        />
        <Button type="submit" variant="search" size="lg" aria-label="Search" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </div>
    </form>
  );
};

export default SearchBar;
