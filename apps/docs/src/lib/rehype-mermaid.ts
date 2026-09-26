/**
 * DX-054: Rehype plugin for build-time Mermaid diagram compilation.
 *
 * Discovers fenced ````mermaid code blocks, extracts captions/titles,
 * parses syntax, renders dual-theme SVGs, and replaces the block
 * with an accessible, scrollable <figure> node in the HAST.
 *
 * Fails the build with file and line context if a diagram is malformed
 * or missing a required caption.
 */

import { parseMermaid, renderMermaidSvg, generateDiagramId } from "./mermaid"
import type { DiagramMeta } from "./mermaid"

function extractMeta(metaStr: string = ""): { caption?: string; title?: string } {
  let caption: string | undefined
  let title: string | undefined

  const captionMatch = metaStr.match(/caption=(?:"([^"]+)"|'([^']+)'|([^\s]+))/)
  if (captionMatch) {
    caption = captionMatch[1] || captionMatch[2] || captionMatch[3]
  }

  const titleMatch = metaStr.match(/title=(?:"([^"]+)"|'([^']+)'|([^\s]+))/)
  if (titleMatch) {
    title = titleMatch[1] || titleMatch[2] || titleMatch[3]
  }

  return { caption, title }
}

function parseSvgToHast(svgStr: string): any {
  // Simple XML/SVG to HAST element parser
  const tagRegex = /<([a-zA-Z0-9_-]+)([^>]*?)(\/?)>|([^<]+)/g
  const rootChildren: any[] = []
  const stack: any[] = [{ children: rootChildren }]

  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(svgStr)) !== null) {
    if (match[4]) {
      // Text node
      const text = match[4].trim()
      if (text.length > 0 && stack.length > 0) {
        stack[stack.length - 1].children.push({
          type: "text",
          value: match[4],
        })
      }
      continue
    }

    const tagName = match[1]
    const rawAttrs = match[2]
    const isSelfClosing = match[3] === "/"

    if (svgStr.substr(match.index, 2) === "</") {
      // Closing tag
      stack.pop()
      continue
    }

    // Parse attributes
    const properties: Record<string, any> = {}
    const attrRegex = /([a-zA-Z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
    let attrMatch: RegExpExecArray | null
    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1]
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? true
      // Map SVG attribute names if needed for JSX / HAST
      let propName = attrName
      if (attrName === "class") propName = "className"
      else if (attrName === "viewbox") propName = "viewBox"
      else if (attrName === "markerwidth") propName = "markerWidth"
      else if (attrName === "markerheight") propName = "markerHeight"
      else if (attrName === "refx") propName = "refX"
      else if (attrName === "refy") propName = "refY"
      else if (attrName === "stroke-width") propName = "strokeWidth"
      else if (attrName === "stroke-dasharray") propName = "strokeDasharray"
      else if (attrName === "text-anchor") propName = "textAnchor"
      else if (attrName === "font-family") propName = "fontFamily"
      else if (attrName === "font-size") propName = "fontSize"
      else if (attrName === "font-weight") propName = "fontWeight"
      else if (attrName === "marker-end") propName = "markerEnd"
      else if (attrName === "aria-labelledby") propName = "ariaLabelledby"

      properties[propName] = attrVal
    }

    const element = {
      type: "element",
      tagName,
      properties,
      children: [],
    }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(element)
    }

    if (!isSelfClosing && tagName !== "path" && tagName !== "line" && tagName !== "circle" && tagName !== "rect" && tagName !== "polygon") {
      stack.push(element)
    }
  }

  return rootChildren[0] || null
}

export function rehypeMermaid() {
  return (tree: any, file: any) => {
    const filePath = file?.path || file?.history?.[0] || "unknown file"

    function visit(node: any, index?: number, parent?: any) {
      if (!node) return

      if (node.type === "element" && node.tagName === "pre") {
        const codeNode = node.children?.find(
          (c: any) => c.type === "element" && c.tagName === "code"
        )
        if (codeNode) {
          const className = codeNode.properties?.className || []
          const isMermaid =
            (Array.isArray(className) && className.some((c) => c.includes("mermaid"))) ||
            (typeof className === "string" && className.includes("mermaid"))

          if (isMermaid) {
            const rawSource = codeNode.children
              ?.map((c: any) => c.value || "")
              .join("") || ""

            const metaStr =
              codeNode.data?.meta ||
              codeNode.properties?.metastring ||
              node.data?.meta ||
              ""

            const { caption, title } = extractMeta(metaStr)

            const diagramMeta: DiagramMeta = {
              caption,
              title,
              file: filePath,
            }

            try {
              const ast = parseMermaid(rawSource, diagramMeta)
              const id = generateDiagramId()
              const rendered = renderMermaidSvg(ast, diagramMeta, id)

              const captionId = `caption-${id}`

              const lightSvgNode = parseSvgToHast(rendered.lightSvg)
              const darkSvgNode = parseSvgToHast(rendered.darkSvg)

              const figureNode = {
                type: "element",
                tagName: "figure",
                properties: {
                  className: [
                    "mermaid-wrapper",
                    "my-6",
                    "rounded-xl",
                    "border",
                    "border-border",
                    "bg-surface-sunken",
                    "overflow-hidden",
                  ],
                  role: "figure",
                  ariaLabelledby: captionId,
                },
                children: [
                  {
                    type: "element",
                    tagName: "div",
                    properties: {
                      className: [
                        "mermaid-scroll",
                        "overflow-x-auto",
                        "p-4",
                        "md:p-6",
                        "focus:outline-none",
                        "focus-visible:ring-2",
                        "focus-visible:ring-primary",
                      ],
                      tabIndex: 0,
                      role: "region",
                      ariaLabel: "Diagram content",
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "div",
                        properties: {
                          className: [
                            "mermaid-diagram",
                            "mermaid-diagram-light",
                            "block",
                            "dark:hidden",
                          ],
                        },
                        children: lightSvgNode ? [lightSvgNode] : [],
                      },
                      {
                        type: "element",
                        tagName: "div",
                        properties: {
                          className: [
                            "mermaid-diagram",
                            "mermaid-diagram-dark",
                            "hidden",
                            "dark:block",
                          ],
                        },
                        children: darkSvgNode ? [darkSvgNode] : [],
                      },
                    ],
                  },
                  {
                    type: "element",
                    tagName: "figcaption",
                    properties: {
                      id: captionId,
                      className: [
                        "mermaid-caption",
                        "px-4",
                        "py-2",
                        "border-t",
                        "border-border",
                        "bg-surface-elevated",
                        "text-xs",
                        "font-sans",
                        "text-text-secondary",
                        "text-center",
                      ],
                    },
                    children: [{ type: "text", value: rendered.caption }],
                  },
                ],
              }

              if (parent && index !== undefined) {
                parent.children[index] = figureNode
              }
              return
            } catch (err: any) {
              const errorMessage = err?.message || String(err)
              throw new Error(`[${filePath}] ${errorMessage}`)
            }
          }
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
          visit(node.children[i], i, node)
        }
      }
    }

    visit(tree)
  }
}
