import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";
import { getPage } from "@/serverFunctions/pages";

// The image alone, fitted to one sheet; the print dialog opens once it loads.
export const Route = createFileRoute("/print/$id")({
  ssr: false,
  loader: ({ params }) => getPage({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.page.title ?? "Print" }],
    styles: [
      {
        children: `@page { size: ${loaderData?.page.shape === "landscape" ? "landscape" : "portrait"}; margin: 10mm; }`,
      },
    ],
  }),
  component: PrintView,
});

function PrintView() {
  const found = Route.useLoaderData();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) window.print();
  }, [loaded]);

  if (!found) {
    return (
      <div className="mx-auto max-w-md p-8" data-testid="page-not-found">
        <EmptyState kind="error" title="Page not found" description="It was deleted or isn't shared with you." />
      </div>
    );
  }
  const { page } = found;
  return (
    <div className="flex h-dvh flex-col bg-background print:h-auto print:bg-transparent">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3 print:hidden">
        <Link
          to="/pages/$id"
          params={{ id: page.id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back
        </Link>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden />
          Print
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 print:block print:p-0">
        <img
          data-testid="print-image"
          src={`/files/${page.id}`}
          alt={page.title}
          onLoad={() => setLoaded(true)}
          className="max-h-full max-w-full object-contain print:mx-auto print:h-[calc(100vh-1mm)] print:max-h-none print:w-auto"
        />
      </div>
    </div>
  );
}
