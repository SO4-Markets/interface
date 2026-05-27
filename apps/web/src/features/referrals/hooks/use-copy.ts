import { useCallback, useState } from "react"
import { toast } from "sonner"

export function useCopy(successMessage = "Copied to clipboard") {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    (text: string) => {
      if (!text) return

      const reset = () => setTimeout(() => setCopied(false), 2000)

      navigator.clipboard.writeText(text).then(
        () => {
          setCopied(true)
          toast.success(successMessage)
          reset()
        },
        () => {
          // Fallback for non-HTTPS or older browsers
          try {
            const el = document.createElement("textarea")
            el.value = text
            el.style.cssText = "position:fixed;top:-9999px;opacity:0"
            document.body.appendChild(el)
            el.select()
            document.execCommand("copy")
            document.body.removeChild(el)
            setCopied(true)
            toast.success(successMessage)
            reset()
          } catch {
            toast.error("Failed to copy — please copy manually")
          }
        },
      )
    },
    [successMessage],
  )

  return { copy, copied }
}
