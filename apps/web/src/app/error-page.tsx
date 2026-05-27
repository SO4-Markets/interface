type Props = {
  onReset?: () => void
}

export function ErrorPage({ onReset }: Props) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. You can try reloading the page or contact support if the
        problem persists.
      </p>
      <button
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        onClick={onReset ?? (() => window.location.reload())}
      >
        Reload
      </button>
    </main>
  )
}
