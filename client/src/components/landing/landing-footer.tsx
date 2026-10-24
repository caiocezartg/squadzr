/**
 * The landing's own footer. The shell footer stays off `/`, so the landing carries this one. It has no
 * hooks and no motion, so it renders on the server only.
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-border/50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-heading text-sm font-bold text-muted">Squadzr</span>
          <p className="text-xs text-muted/60">
            &copy; {new Date().getFullYear()} Squadzr. Built for gamers.
          </p>
          <a
            href="https://www.igdb.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted/60 transition-colors hover:text-muted"
          >
            game data by IGDB
          </a>
        </div>
      </div>
    </footer>
  )
}
