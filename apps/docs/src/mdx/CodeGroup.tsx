import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react"

import { Tab, Tabs } from "./Tabs"

interface TitledCodeBlockProps {
  title?: string
  "data-title"?: string
  children?: ReactNode
}

export interface CodeGroupProps {
  groupId: string
  children: ReactNode
}

function getCodeTitle(
  child: ReactElement<TitledCodeBlockProps>,
  index: number
) {
  return (
    child.props.title ?? child.props["data-title"] ?? `Example ${index + 1}`
  )
}

export function CodeGroup({ groupId, children }: CodeGroupProps) {
  const blocks = Children.toArray(children).filter(
    (child): child is ReactElement<TitledCodeBlockProps> =>
      isValidElement<TitledCodeBlockProps>(child)
  )

  return (
    <Tabs groupId={groupId} aria-label="Code examples">
      {blocks.map((block, index) => {
        const title = getCodeTitle(block, index)
        return (
          <Tab key={`${title}-${index}`} label={title} value={title}>
            {block}
          </Tab>
        )
      })}
    </Tabs>
  )
}
