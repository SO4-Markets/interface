"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

const STORAGE_PREFIX = "so4-docs-tabs:"
const CHANGE_EVENT = "so4:docs-tabs-change"

interface TabsChangeDetail {
  groupId: string
  value: string
}

export function useTabs(groupId: string, values: string[]) {
  const valuesKey = values.join("\u0000")
  const stableValues = useMemo(() => values, [valuesKey])
  const firstValue = stableValues[0] ?? ""
  const [value, setValue] = useState(firstValue)

  useEffect(() => {
    setValue(firstValue)

    try {
      const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${groupId}`)
      if (stored && stableValues.includes(stored)) setValue(stored)
    } catch {
      // Storage can be disabled by privacy settings. The first tab stays active.
    }

    function handleChange(event: Event) {
      const detail = (event as CustomEvent<TabsChangeDetail>).detail
      if (detail.groupId === groupId && stableValues.includes(detail.value)) {
        setValue(detail.value)
      }
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === `${STORAGE_PREFIX}${groupId}` &&
        event.newValue &&
        stableValues.includes(event.newValue)
      ) {
        setValue(event.newValue)
      }
    }

    window.addEventListener(CHANGE_EVENT, handleChange)
    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange)
      window.removeEventListener("storage", handleStorage)
    }
  }, [firstValue, groupId, stableValues])

  const select = useCallback(
    (nextValue: string) => {
      if (!stableValues.includes(nextValue)) return
      setValue(nextValue)

      try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${groupId}`, nextValue)
      } catch {
        // The current interaction still works when persistence is unavailable.
      }

      window.dispatchEvent(
        new CustomEvent<TabsChangeDetail>(CHANGE_EVENT, {
          detail: { groupId, value: nextValue },
        })
      )
    },
    [groupId, stableValues]
  )

  return { value, select }
}
