import { useEffect, useState } from "react"
import { ChevronDownIcon } from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Icon } from "@workspace/ui/components/icon"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { CHANGELOG_AREAS, CHANGELOG_TYPES, areaLabel, publicAreas, typeLabel } from "../utils"
import type { ChangelogArea, ChangelogEntryType, ChangelogSearch } from "../types"

interface FilterBarProps {
  search: ChangelogSearch
  onFilterChange: (search: ChangelogSearch) => void
  activeFilterCount: number
}

export function FilterBar({
  search,
  onFilterChange,
  activeFilterCount,
}: FilterBarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(search.q || "")

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search.q) {
        onFilterChange({ ...search, q: searchInput || undefined })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, search, onFilterChange])

  // Update local input when search param changes externally
  useEffect(() => {
    setSearchInput(search.q || "")
  }, [search.q])

  const handleTypeFilter = (type: ChangelogEntryType | undefined) => {
    onFilterChange({ ...search, type })
  }

  const handleAreaFilter = (area: ChangelogArea | undefined) => {
    onFilterChange({ ...search, area })
  }

  const handleShowInternal = (checked: boolean) => {
    onFilterChange({ ...search, showInternal: checked || undefined })
  }

  const areaOptions = search.showInternal ? CHANGELOG_AREAS : publicAreas()

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value)
  }

  const handleClearAll = () => {
    onFilterChange({})
    setSearchInput("")
  }

  const allTypesActive = !search.type && !search.area

  return (
    <>
      {/* Mobile: Collapsible filter bar */}
      <div className="mb-6 md:hidden">
        <Button
          variant="outline"
          className="h-11 w-full justify-between px-4 focus-visible:ring-2"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
        >
          <span className="flex items-center gap-2">
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="success" size="sm" className="ml-auto">
                {activeFilterCount}
              </Badge>
            )}
          </span>
          <Icon
            icon={ChevronDownIcon}
            className={`transition-transform ${isFilterOpen ? "rotate-180" : ""}`}
          />
        </Button>

        {/* Collapsible content */}
        {isFilterOpen && (
          <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-raised p-4">
            {/* Category chips - scrollable row on mobile */}
            <div>
              <p className="mb-2 text-label">Category</p>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={allTypesActive ? "default" : "outline"}
                  size="sm"
                  className="cursor-pointer transition-all h-9 px-3 py-1 focus-visible:ring-2"
                  onClick={() => handleTypeFilter(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleTypeFilter(undefined)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  All
                </Badge>
                {CHANGELOG_TYPES.map((type) => (
                  <Badge
                    key={type}
                    variant={search.type === type ? "default" : "outline"}
                    size="sm"
                    className="h-9 cursor-pointer px-3 py-1 transition-all focus-visible:ring-2"
                    onClick={() => handleTypeFilter(type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleTypeFilter(type)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {typeLabel(type)}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Area dropdown */}
            <div>
              <label className="mb-2 block text-label">Area</label>
              <Select
                value={search.area || "all"}
                onValueChange={(v) =>
                  handleAreaFilter(
                    v === "all" ? undefined : (v as ChangelogArea)
                  )
                }
              >
                <SelectTrigger className="h-11 w-full" aria-label="Filter by area">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {areaOptions.map((area) => (
                    <SelectItem key={area} value={area}>
                      {areaLabel(area)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div>
              <label className="mb-2 block text-label">Search</label>
              <Input
                placeholder="Search entries..."
                value={searchInput}
                onChange={handleSearchChange}
                className="h-11"
              />
            </div>

            {/* Internal changes toggle (URL-backed) */}
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="changelog-show-internal" className="text-label">
                Show internal changes
              </label>
              <Switch
                id="changelog-show-internal"
                checked={Boolean(search.showInternal)}
                onCheckedChange={handleShowInternal}
              />
            </div>

            {/* Clear button */}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                className="h-9 w-full text-text-secondary"
                onClick={handleClearAll}
              >
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Desktop: Always visible filter bar */}
      <div className="mb-8 hidden flex-wrap items-center gap-4 md:flex">
        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={allTypesActive ? "default" : "outline"}
            size="sm"
            className="cursor-pointer transition-all h-9 px-3 py-1 focus-visible:ring-2"
            onClick={() => handleTypeFilter(undefined)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleTypeFilter(undefined)
              }
            }}
            role="button"
            tabIndex={0}
          >
            All
          </Badge>
          {CHANGELOG_TYPES.map((type) => (
            <Badge
              key={type}
              variant={search.type === type ? "default" : "outline"}
              size="sm"
              className="h-9 cursor-pointer px-3 py-1 transition-all focus-visible:ring-2"
              onClick={() => handleTypeFilter(type)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleTypeFilter(type)
                }
              }}
              role="button"
              tabIndex={0}
            >
              {typeLabel(type)}
            </Badge>
          ))}
        </div>

        {/* Area dropdown */}
        <Select
          value={search.area || "all"}
          onValueChange={(v) =>
            handleAreaFilter(v === "all" ? undefined : (v as ChangelogArea))
          }
        >
          <SelectTrigger className="h-9 w-48" aria-label="Filter by area">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {CHANGELOG_AREAS.map((area) => (
              <SelectItem key={area} value={area}>
                {areaLabel(area)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <Input
          placeholder="Search..."
          value={searchInput}
          onChange={handleSearchChange}
          className="h-9 min-w-xs flex-1"
        />

        {/* Internal changes toggle (URL-backed) */}
        <div className="flex items-center gap-2">
          <Switch
            id="changelog-show-internal"
            checked={Boolean(search.showInternal)}
            onCheckedChange={handleShowInternal}
          />
          <label htmlFor="changelog-show-internal" className="text-label">
            Show internal changes
          </label>
        </div>
      </div>
    </>
  )
}
