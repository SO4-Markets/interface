export function LoadingPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <div className="space-y-2 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
