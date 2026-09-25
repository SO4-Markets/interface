/**
 * Sole notification entry-point for the web app (OB-091).
 *
 * All notifications go through the custom `@workspace/ui/components/toast`
 * singleton + `ToastProvider` mounted once in `apps/web/src/routes/__root.tsx`.
 * Do not add Sonner or a second toaster. The legacy context-based
 * `toast.tsx` implementation was removed after verifying zero callers; this
 * module is the redirect that keeps the `@/shared/components/toast` import
 * path working for any external references.
 */
export { useToast, ToastProvider } from "@workspace/ui/components/toast"
export type { ToastVariant, ToastItem } from "@workspace/ui/components/toast"
