"use client"

import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react"
import {
  Tabs as TabsPrimitive,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { useTabs } from "./useTabs"

export interface TabProps {
  label: string
  value?: string
  children: ReactNode
}

export function Tab({ children }: TabProps) {
  return <>{children}</>
}

export interface TabsProps {
  groupId: string
  children: ReactNode
  "aria-label"?: string
}

export function Tabs({
  groupId,
  children,
  "aria-label": ariaLabel = "Options",
}: TabsProps) {
  const tabs = Children.toArray(children).filter(
    (child): child is ReactElement<TabProps> => isValidElement<TabProps>(child)
  )
  const values = tabs.map((tab) => tab.props.value ?? tab.props.label)
  const { value, select } = useTabs(groupId, values)

  if (tabs.length === 0) return null

  return (
    <TabsPrimitive value={value} onValueChange={select} className="my-6">
      <TabsList variant="line" aria-label={ariaLabel}>
        {tabs.map((tab, index) => (
          <TabsTrigger key={values[index]} value={values[index]}>
            {tab.props.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab, index) => (
        <TabsContent
          key={values[index]}
          value={values[index]}
          keepMounted
          data-tab-label={tab.props.label ?? values[index]}
          className="mt-4 text-sm print:block"
        >
          {tab.props.children}
        </TabsContent>
      ))}
    </TabsPrimitive>
  )
}
