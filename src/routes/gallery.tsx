import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageCard, PageGrid } from "@/client/components/PageCard";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { THEMES, labelOf, themeSchema, type Theme } from "@/server/options";
import { listGallery } from "@/serverFunctions/pages";

interface GallerySearch {
  theme?: Theme;
  q?: string;
  page?: number;
}

const ALL = "all";
const THEME_ITEMS = [{ value: ALL, label: "All themes" }, ...THEMES];

export const Route = createFileRoute("/gallery")({
  validateSearch: (search: Record<string, unknown>): GallerySearch => {
    const page = Number(search.page);
    return {
      theme: themeSchema.safeParse(search.theme).data,
      q: typeof search.q === "string" && search.q.trim() ? search.q.slice(0, 100) : undefined,
      page: Number.isInteger(page) && page > 1 ? page : undefined,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listGallery({ data: { theme: deps.theme, q: deps.q, page: deps.page ?? 1 } }),
  head: () => ({ meta: [{ title: "Gallery · Coloring Page Maker" }] }),
  component: Gallery,
});

function Gallery() {
  const { items, hasMore } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/gallery" });
  const page = search.page ?? 1;
  const [query, setQuery] = useState(search.q ?? "");

  // Searches once typing pauses.
  useEffect(() => {
    const next = query.trim() || undefined;
    if (next === search.q) return;
    const timer = setTimeout(
      () => void navigate({ search: (prev) => ({ ...prev, q: next, page: undefined }), replace: true }),
      250,
    );
    return () => clearTimeout(timer);
  }, [query, search.q, navigate]);

  const filtered = Boolean(search.theme || search.q);

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Gallery" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            data-testid="gallery-search"
            aria-label="Search"
            placeholder="Search titles and descriptions"
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select
          items={THEME_ITEMS}
          value={search.theme ?? ALL}
          onValueChange={(value) => {
            if (value === null) return;
            void navigate({
              search: (prev) => ({
                ...prev,
                theme: value === ALL ? undefined : themeSchema.parse(value),
                page: undefined,
              }),
            });
          }}
        >
          <SelectTrigger data-testid="theme-filter" aria-label="Theme" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEME_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <div data-testid="gallery-empty">
          {filtered ? (
            <EmptyState kind="filtered" title="No matching pages" description="Try another theme or search." />
          ) : (
            <EmptyState
              title="Nothing shared yet"
              description="Open one of your pages and choose Share to gallery."
            />
          )}
        </div>
      ) : (
        <PageGrid>
          {items.map((item) => (
            <PageCard
              key={item.id}
              page={item}
              testId="gallery-card"
              extra={<Badge variant="soft">{labelOf(THEMES, item.theme)}</Badge>}
            />
          ))}
        </PageGrid>
      )}

      {page > 1 || hasMore ? (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            data-testid="prev-page"
            disabled={page <= 1}
            onClick={() => void navigate({ search: (prev) => ({ ...prev, page: page - 1 > 1 ? page - 1 : undefined }) })}
          >
            <ChevronLeft aria-hidden />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">Page {page}</span>
          <Button
            variant="outline"
            data-testid="next-page"
            disabled={!hasMore}
            onClick={() => void navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })}
          >
            Next
            <ChevronRight aria-hidden />
          </Button>
        </div>
      ) : null}
    </AppShell>
  );
}
