import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Download, Pencil, Printer, Share2, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  AGE_LEVELS,
  SHAPES,
  THEMES,
  TITLE_MAX,
  ageLevelSchema,
  labelOf,
  shapeSchema,
  themeSchema,
  type Theme,
} from "@/server/options";
import type { PageRecord } from "@/server/pages";
import {
  deletePage,
  getPage,
  publishPage,
  renamePage,
  unpublishPage,
} from "@/serverFunctions/pages";

export const Route = createFileRoute("/pages/$id")({
  loader: ({ params }) => getPage({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.page.title ?? "Page"} · Coloring Page Maker` }],
  }),
  component: PageDetail,
});

const BACK_LINK =
  "inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground";

function PageDetail() {
  const found = Route.useLoaderData();
  if (!found) {
    return (
      <AppShell nav={<AppNav />}>
        <div data-testid="page-not-found">
          <EmptyState
            kind="error"
            title="Page not found"
            description="It was deleted or isn't shared with you."
            action={
              <Button variant="outline" nativeButton={false} render={<Link to="/history" />}>
                My pages
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }
  return <Detail {...found} />;
}

type Dialog = "rename" | "publish" | "delete" | "remove" | null;

function Detail({
  page,
  isOwner,
  canRemoveFromGallery,
}: {
  page: PageRecord;
  isOwner: boolean;
  canRemoveFromGallery: boolean;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, setPending] = useState(false);
  const published = page.publishedAt !== null;

  async function change(work: () => Promise<unknown>, done?: string) {
    setPending(true);
    try {
      await work();
      setDialog(null);
      if (done) toast.success(done);
      await router.invalidate();
    } catch {
      toast.error("That didn't save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        backLink={
          isOwner ? (
            <Link to="/history" className={BACK_LINK}>
              <ChevronLeft className="size-4" aria-hidden />
              My pages
            </Link>
          ) : (
            <Link to="/gallery" className={BACK_LINK}>
              <ChevronLeft className="size-4" aria-hidden />
              Gallery
            </Link>
          )
        }
        title={<span data-testid="page-title">{page.title}</span>}
        description={
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <Badge variant="secondary">{labelOf(AGE_LEVELS, page.ageLevel)}</Badge>
            <Badge variant="outline">{labelOf(SHAPES, page.shape)}</Badge>
            {published ? (
              <Badge variant="soft" data-testid="gallery-badge">
                In gallery · {labelOf(THEMES, page.theme)}
              </Badge>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button
          nativeButton={false}
          data-testid="download"
          render={<a href={`/files/${page.id}?download=1`} download />}
        >
          <Download aria-hidden />
          Download
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          data-testid="print"
          render={<Link to="/print/$id" params={{ id: page.id }} />}
        >
          <Printer aria-hidden />
          Print
        </Button>
        <Button
          variant="outline"
          data-testid="reuse"
          onClick={() =>
            void navigate({
              to: "/",
              search: {
                prompt: page.prompt,
                age: ageLevelSchema.safeParse(page.ageLevel).data,
                shape: shapeSchema.safeParse(page.shape).data,
              },
            })
          }
        >
          <Wand2 aria-hidden />
          Use these settings
        </Button>
        {isOwner ? (
          <>
            <Button variant="outline" data-testid="rename" onClick={() => setDialog("rename")}>
              <Pencil aria-hidden />
              Rename
            </Button>
            <Button variant="outline" data-testid="publish" onClick={() => setDialog("publish")}>
              <Share2 aria-hidden />
              {published ? "Edit gallery entry" : "Share to gallery"}
            </Button>
            {published ? (
              <Button
                variant="outline"
                data-testid="unpublish"
                pending={pending && dialog === null}
                onClick={() =>
                  void change(() => unpublishPage({ data: { id: page.id } }), "Removed from the gallery")
                }
              >
                Remove from gallery
              </Button>
            ) : null}
            <Button variant="destructive" data-testid="delete" onClick={() => setDialog("delete")}>
              <Trash2 aria-hidden />
              Delete
            </Button>
          </>
        ) : null}
        {canRemoveFromGallery ? (
          <Button variant="destructive" data-testid="remove-from-gallery" onClick={() => setDialog("remove")}>
            Remove from gallery
          </Button>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className="text-sm font-medium">Description</div>
        <p className="text-sm text-muted-foreground" data-testid="page-prompt">
          {page.prompt}
        </p>
      </div>

      <div className="flex justify-center rounded-xl border border-border bg-muted/40 p-4">
        <img
          data-testid="page-image"
          src={`/files/${page.id}`}
          alt={page.title}
          className="max-h-[75vh] w-auto max-w-full rounded-sm bg-background object-contain shadow-sm"
        />
      </div>

      {dialog === "rename" ? (
        <TitleDialog
          initial={page.title}
          pending={pending}
          onClose={() => setDialog(null)}
          onSave={(title) => void change(() => renamePage({ data: { id: page.id, title } }))}
        />
      ) : null}
      {dialog === "publish" ? (
        <GalleryDialog
          page={page}
          pending={pending}
          onClose={() => setDialog(null)}
          onSave={(title, theme) =>
            void change(
              () => publishPage({ data: { id: page.id, title, theme } }),
              published ? "Gallery entry saved" : "Shared to the gallery",
            )
          }
        />
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title="Delete this page?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          testId="confirm-delete"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            setPending(true);
            try {
              await deletePage({ data: { id: page.id } });
              toast.success("Page deleted");
              await navigate({ to: "/history" });
            } catch {
              toast.error("That didn't delete. Try again.");
              setPending(false);
            }
          }}
        >
          The image is deleted too{published ? " and it leaves the gallery" : ""}.
        </ConfirmDialog>
      ) : null}
      {dialog === "remove" ? (
        <ConfirmDialog
          title="Remove from the gallery?"
          confirmLabel="Remove"
          destructive
          pending={pending}
          testId="confirm-remove"
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void change(() => unpublishPage({ data: { id: page.id } }), "Removed from the gallery")
          }
        >
          Its owner keeps the page.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

function TitleDialog({
  initial,
  pending,
  onClose,
  onSave,
}: {
  initial: string;
  pending: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(initial);
  return (
    <FormDialog
      title="Rename"
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="rename-form"
            data-testid="save-title"
            pending={pending}
            disabled={!title.trim()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        id="rename-form"
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) onSave(title.trim());
        }}
      >
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          data-testid="title-input"
          value={title}
          maxLength={TITLE_MAX}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
        />
      </form>
    </FormDialog>
  );
}

function GalleryDialog({
  page,
  pending,
  onClose,
  onSave,
}: {
  page: PageRecord;
  pending: boolean;
  onClose: () => void;
  onSave: (title: string, theme: Theme) => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [theme, setTheme] = useState<Theme | null>(themeSchema.safeParse(page.theme).data ?? null);
  const ready = Boolean(title.trim() && theme);
  return (
    <FormDialog
      title={page.publishedAt ? "Edit gallery entry" : "Share to gallery"}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="gallery-form"
            data-testid="save-gallery"
            pending={pending}
            disabled={!ready}
          >
            {page.publishedAt ? "Save" : "Share"}
          </Button>
        </>
      }
    >
      <form
        id="gallery-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim() && theme) onSave(title.trim(), theme);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="gallery-title">Title</Label>
          <Input
            id="gallery-title"
            data-testid="gallery-title"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Theme</Label>
          <Select
            items={THEMES}
            value={theme}
            onValueChange={(value) => setTheme(themeSchema.safeParse(value).data ?? null)}
          >
            <SelectTrigger data-testid="gallery-theme" aria-label="Theme" className="w-full">
              <SelectValue placeholder="Pick a theme" />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </form>
    </FormDialog>
  );
}
