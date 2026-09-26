import React, { useState, useEffect } from "react"
import { cn } from "@workspace/ui/lib/utils"

export interface SearchResult {
  url: string
  title: string
  excerpt?: string
}

export interface SearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onSearch?: (query: string) => Promise<SearchResult[]>
  initialQuery?: string
  className?: string
}

export function SearchDialog({ isOpen, onClose, onSearch, initialQuery = "", className }: SearchDialogProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery)
    }
  }, [isOpen, initialQuery])

  useEffect(() => {
    if (!isOpen) {
      setResults([])
      setError(null)
      return
    }

    let active = true

    async function executeSearch() {
      if (!query.trim()) {
        setResults([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        if (onSearch) {
          const res = await onSearch(query)
          if (active) setResults(res)
        } else {
          const response = await fetch(`/pagefind/pagefind.json?q=${encodeURIComponent(query)}`)
          if (!response.ok) throw new Error("Search request failed")
          const data = await response.json()
          if (active) setResults(data.results || [])
        }
      } catch (err: any) {
        if (active) setError(err.message || "Failed to execute search")
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = setTimeout(executeSearch, 150)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, isOpen, onSearch])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
      data-search-dialog
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/50 backdrop-blur-sm",
        className,
      )}
    >
      <div className="bg-surface-canvas border border-border rounded-xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <input
            type="search"
            data-search-input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation..."
            className="w-full bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-base"
          />
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs rounded border border-border text-text-secondary hover:text-text-primary"
          >
            Esc
          </button>
        </div>

        <div data-search-results className="max-h-96 overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-sm text-text-tertiary py-4 text-center">Searching...</p>}
          {error && <p className="text-sm text-error py-4 text-center">{error}</p>}
          {!loading && !error && query.trim() !== "" && results.length === 0 && (
            <p className="text-sm text-text-tertiary py-4 text-center">No results found for "{query}"</p>
          )}
          {results.map((result) => (
            <a
              key={result.url}
              href={result.url}
              onClick={onClose}
              className="block p-3 rounded-lg hover:bg-surface-hover transition-colors border border-transparent hover:border-border"
            >
              <div className="text-sm font-semibold text-text-accent">{result.title}</div>
              {result.excerpt && (
                <div
                  className="text-xs text-text-secondary mt-1 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: result.excerpt }}
                />
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
