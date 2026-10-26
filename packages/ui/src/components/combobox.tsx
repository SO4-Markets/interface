import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

function Combobox<TValue>(props: ComboboxPrimitive.Root.Props<TValue>) {
  return <ComboboxPrimitive.Root data-slot="combobox" {...props} />
}

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      render={<Input />}
      className={cn("h-10 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0", className)}
      {...props}
    />
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

function ComboboxItem({ className, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn("space-y-1", className)}
      {...props}
    />
  )
}

function ComboboxGroupLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-group-label"
      className={cn("px-3 py-2 text-10 font-medium tracking-[0.08em] text-muted-foreground uppercase", className)}
      {...props}
    />
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn("p-0", className)}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
}
