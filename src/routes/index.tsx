import { Link, createFileRoute } from "@tanstack/react-router";
import { Download, Printer, RefreshCw, Shuffle, Sparkles, X } from "lucide-react";
import { useRef, useState, type Ref } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/client/components/ui/toggle-group";
import {
  AGE_LEVELS,
  IDEAS,
  PROMPT_MAX,
  SHAPES,
  ageLevelSchema,
  labelOf,
  shapeSchema,
  type AgeLevel,
  type Shape,
} from "@/server/options";
import type { PageRecord } from "@/server/pages";
import { generatePage, getAllowance } from "@/serverFunctions/pages";

interface GeneratorSearch {
  prompt?: string;
  age?: AgeLevel;
  shape?: Shape;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): GeneratorSearch => ({
    prompt: typeof search.prompt === "string" ? search.prompt.slice(0, PROMPT_MAX) : undefined,
    age: ageLevelSchema.safeParse(search.age).data,
    shape: shapeSchema.safeParse(search.shape).data,
  }),
  loader: () => getAllowance(),
  head: () => ({ meta: [{ title: "Create · Coloring Page Maker" }] }),
  component: GeneratorRoute,
});

function GeneratorRoute() {
  const search = Route.useSearch();
  // A new set of settings from another page starts a fresh form.
  return <Generator key={JSON.stringify(search)} search={search} />;
}

const PRESSED = "aria-pressed:border-primary/40 aria-pressed:bg-primary/15 aria-pressed:text-primary";

type Settings = { prompt: string; ageLevel: AgeLevel; shape: Shape };

function Generator({ search }: { search: GeneratorSearch }) {
  const allowance = Route.useLoaderData();
  const [prompt, setPrompt] = useState(search.prompt ?? "");
  const [ageLevel, setAgeLevel] = useState<AgeLevel>(search.age ?? "kids");
  const [shape, setShape] = useState<Shape>(search.shape ?? "portrait");
  const [remaining, setRemaining] = useState(allowance.remaining);
  const [result, setResult] = useState<PageRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const usedUp = remaining <= 0;
  const resultRef = useRef<HTMLElement>(null);

  async function run(settings: Settings) {
    setPending(true);
    setError(null);
    try {
      const outcome = await generatePage({ data: settings });
      setRemaining(outcome.remaining);
      if (outcome.ok) setResult(outcome.page);
      else if (outcome.reason === "failed")
        setError("The page couldn't be drawn. Try again or change the description.");
    } catch {
      setError("The page couldn't be drawn. Try again or change the description.");
    } finally {
      setPending(false);
    }
  }

  function randomIdea() {
    const others = IDEAS.filter((idea) => idea !== prompt);
    setPrompt(others[Math.floor(Math.random() * others.length)]!);
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Create a coloring page"
        description={
          <span data-testid="remaining">
            {remaining} {remaining === 1 ? "page" : "pages"} left today
          </span>
        }
      />

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (prompt.trim() && !usedUp) void run({ prompt: prompt.trim(), ageLevel, shape });
        }}
      >
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="prompt">Description</Label>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" data-testid="random-idea" onClick={randomIdea}>
                <Shuffle aria-hidden />
                Random idea
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="clear-prompt"
                disabled={!prompt}
                onClick={() => setPrompt("")}
              >
                <X aria-hidden />
                Clear
              </Button>
            </div>
          </div>
          <Textarea
            id="prompt"
            data-testid="prompt-input"
            value={prompt}
            maxLength={PROMPT_MAX}
            rows={3}
            placeholder="A fox reading under a mushroom"
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="text-right text-xs text-muted-foreground tabular-nums" data-testid="prompt-count">
            {prompt.length}/{PROMPT_MAX}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Age level</Label>
            <ToggleGroup
              variant="outline"
              value={[ageLevel]}
              onValueChange={(next) => {
                const picked = ageLevelSchema.safeParse(next[0]);
                if (picked.success) setAgeLevel(picked.data);
              }}
              className="flex-wrap"
            >
              {AGE_LEVELS.map((level) => (
                <ToggleGroupItem key={level.value} value={level.value} data-testid={`age-${level.value}`} className={PRESSED}>
                  {level.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label>Page shape</Label>
            <ToggleGroup
              variant="outline"
              value={[shape]}
              onValueChange={(next) => {
                const picked = shapeSchema.safeParse(next[0]);
                if (picked.success) setShape(picked.data);
              }}
              className="flex-wrap"
            >
              {SHAPES.map((item) => (
                <ToggleGroupItem key={item.value} value={item.value} data-testid={`shape-${item.value}`} className={PRESSED}>
                  {item.label} <span className="text-muted-foreground">{item.ratio}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        {usedUp ? (
          <Alert data-testid="limit-reached">
            <AlertDescription>
              All {allowance.limit} of today's pages are used. You can make more tomorrow.
            </AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive" data-testid="generate-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          size="lg"
          data-testid="generate"
          pending={pending}
          disabled={!prompt.trim() || usedUp}
        >
          {pending ? null : <Sparkles aria-hidden />}
          {pending ? "Drawing…" : "Generate"}
        </Button>
      </form>

      {result ? (
        <Result
          ref={resultRef}
          page={result}
          pending={pending}
          disabled={usedUp}
          onRegenerate={() =>
            void run({
              prompt: result.prompt,
              ageLevel: ageLevelSchema.parse(result.ageLevel),
              shape: shapeSchema.parse(result.shape),
            })
          }
        />
      ) : null}
    </AppShell>
  );
}

function Result({
  ref,
  page,
  pending,
  disabled,
  onRegenerate,
}: {
  ref: Ref<HTMLElement>;
  page: PageRecord;
  pending: boolean;
  disabled: boolean;
  onRegenerate: () => void;
}) {
  return (
    <section ref={ref} data-testid="result" className="scroll-mt-4 space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link
            to="/pages/$id"
            params={{ id: page.id }}
            className="block truncate font-medium hover:underline"
          >
            {page.title}
          </Link>
          <div className="text-xs text-muted-foreground">
            {labelOf(AGE_LEVELS, page.ageLevel)} · {labelOf(SHAPES, page.shape)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
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
            data-testid="regenerate"
            pending={pending}
            disabled={disabled}
            onClick={onRegenerate}
          >
            {pending ? null : <RefreshCw aria-hidden />}
            Regenerate
          </Button>
        </div>
      </div>
      <div className="flex justify-center rounded-lg bg-muted/40 p-3">
        <img
          key={page.id}
          data-testid="result-image"
          src={`/files/${page.id}`}
          alt={page.title}
          // A new page scrolls into view once it has its height.
          onLoad={() => {
            if (typeof ref === "object" && ref?.current) ref.current.scrollIntoView({ block: "start" });
          }}
          className="max-h-[70vh] w-auto max-w-full rounded-sm bg-background object-contain shadow-sm"
        />
      </div>
    </section>
  );
}
