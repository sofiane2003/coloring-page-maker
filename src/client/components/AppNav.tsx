import { Link } from "@tanstack/react-router";

const LINK =
  "rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

/** The app's pages, in the AppShell bar. */
export function AppNav() {
  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
      <Link to="/" className={LINK} activeOptions={{ exact: true, includeSearch: false }}>
        Create
      </Link>
      <Link to="/history" className={LINK}>
        My pages
      </Link>
      <Link to="/gallery" className={LINK}>
        Gallery
      </Link>
    </nav>
  );
}
