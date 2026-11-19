import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Badge } from "@/client/components/ui/badge";
import { AGE_LEVELS, SHAPES, labelOf } from "@/server/options";

export interface PageSummary {
  id: string;
  title: string;
  prompt: string;
  ageLevel: string;
  shape: string;
}

/** A page's thumbnail with its title, prompt and settings; links to the page. */
export function PageCard({
  page,
  testId,
  extra,
}: {
  page: PageSummary;
  testId: string;
  extra?: ReactNode;
}) {
  return (
    <li
      data-testid={testId}
      data-page-id={page.id}
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <Link to="/pages/$id" params={{ id: page.id }} className="block">
        <div className="flex aspect-square items-center justify-center border-b border-border bg-muted/40 p-3">
          <img
            src={`/files/${page.id}`}
            alt={page.title}
            loading="lazy"
            className="max-h-full max-w-full rounded-sm bg-background object-contain shadow-xs"
          />
        </div>
        <div className="space-y-2 p-3">
          <div className="truncate text-sm font-medium">{page.title}</div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{page.prompt}</p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{labelOf(AGE_LEVELS, page.ageLevel)}</Badge>
            <Badge variant="outline">{labelOf(SHAPES, page.shape)}</Badge>
            {extra}
          </div>
        </div>
      </Link>
    </li>
  );
}

export function PageGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</ul>;
}
