import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageCard, PageGrid } from "@/client/components/PageCard";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { listMyPages } from "@/serverFunctions/pages";

export const Route = createFileRoute("/history")({
  loader: () => listMyPages(),
  head: () => ({ meta: [{ title: "My pages · Coloring Page Maker" }] }),
  component: History,
});

function History() {
  const pages = Route.useLoaderData();
  const newPage = (
    <Button nativeButton={false} render={<Link to="/" />}>
      <Plus aria-hidden />
      New page
    </Button>
  );
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="My pages" actions={pages.length ? newPage : null} />
      {pages.length === 0 ? (
        <div data-testid="history-empty">
          <EmptyState
            title="No pages yet"
            description="Pages you generate appear here."
            action={newPage}
          />
        </div>
      ) : (
        <PageGrid>
          {pages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              testId="page-card"
              extra={page.publishedAt ? <Badge variant="soft">In gallery</Badge> : null}
            />
          ))}
        </PageGrid>
      )}
    </AppShell>
  );
}
