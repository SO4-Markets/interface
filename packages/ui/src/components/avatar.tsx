import { forwardRef, useState } from "react"
import { cva } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"
import type { VariantProps } from "class-variance-authority"

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised ring-1 ring-border font-medium text-text-inverse",
  {
    variants: {
      size: {
        xs: "size-5 text-9-5",
        sm: "size-6 text-10",
        md: "size-8 text-11",
        lg: "size-10 text-13",
        xl: "size-12 text-14-5",
        "2xl": "size-16 text-17",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

interface AvatarProps extends React.ComponentProps<"div">, VariantProps<typeof avatarVariants> {
  src?: string
  alt?: string
  fallback?: React.ReactNode
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = "md", src, alt, fallback, ...props }, ref) => {
    const [imageError, setImageError] = useState(false)
    const showImage = !!src && !imageError

    return (
      <div
        ref={ref}
        data-slot="avatar"
        className={cn(avatarVariants({ size }), className)}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span
            className="flex items-center justify-center"
            role={alt ? "img" : "presentation"}
            aria-label={alt}
          >
            {fallback}
          </span>
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

const AvatarImage = forwardRef<HTMLImageElement, React.ComponentProps<"img">>(
  ({ className, ...props }, ref) => (
    <img ref={ref} data-slot="avatar-image" className={cn("h-full w-full object-cover", className)} {...props} />
  )
)
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="avatar-fallback"
      className={cn("flex items-center justify-center font-medium", className)}
      {...props}
    />
  )
)
AvatarFallback.displayName = "AvatarFallback"

interface AvatarGroupProps extends React.ComponentProps<"div">, VariantProps<typeof avatarVariants> {
  max?: number
  overlap?: number
  showCount?: boolean
}

const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, size = "md", max, overlap = 8, showCount = true, children, ...props }, ref) => {
    const childArray = Array.isArray(children) ? children : children ? [children] : []
    const visibleChildren = max ? childArray.slice(0, max) : childArray
    const hiddenCount = max ? childArray.length - max : 0

    return (
      <div
        ref={ref}
        data-slot="avatar-group"
        className={cn("inline-flex items-center", className)}
        role="group"
        aria-label={`Group of ${childArray.length} avatars${hiddenCount > 0 ? ` with ${hiddenCount} hidden` : ""}`}
        {...props}
        style={{
          display: "flex",
          gap: 0,
          ...props.style,
        }}
      >
        {visibleChildren.map((child, idx) => (
          <div
            key={idx}
            style={{
              marginLeft: idx === 0 ? 0 : -overlap,
              zIndex: visibleChildren.length - idx,
            }}
          >
            {child}
          </div>
        ))}
        {hiddenCount > 0 && showCount && (
          <div
            className={cn(
              avatarVariants({ size }),
              "border border-dashed border-border bg-muted/30 text-text-secondary"
            )}
            style={{
              marginLeft: -overlap,
              zIndex: 0,
            }}
            role="img"
            aria-label={`${hiddenCount} more members`}
          >
            <span className="text-9-5 font-semibold">+{hiddenCount}</span>
          </div>
        )}
      </div>
    )
  }
)
AvatarGroup.displayName = "AvatarGroup"

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  avatarVariants,
  type AvatarProps,
  type AvatarGroupProps,
}
