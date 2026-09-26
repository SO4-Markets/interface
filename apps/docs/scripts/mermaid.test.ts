import { test, expect, describe } from "bun:test"
import {
  parseMermaid,
  renderMermaidSvg,
  renderMermaidFigureHtml,
  generateDiagramId,
} from "../src/lib/mermaid"
import { rehypeMermaid } from "../src/lib/rehype-mermaid"

/**
 * The subset of HAST these tests build and assert on. `rehypeMermaid` is
 * typed against `any` and rewrites the tree in place, so the input literal
 * has to be declared with the shape of the *output* nodes — otherwise TS
 * infers the literal's own narrow type and the post-transform assertions
 * (`figure.properties`, `scrollDiv.children`) do not typecheck.
 */
type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  data?: { meta?: string }
  children?: Array<HastNode>
}

type HastRoot = { type: string; children: Array<HastNode> }

describe("DX-054: Build-time Mermaid diagram support", () => {
  const validFlowchart = `
graph TD
  Contracts[Soroban contracts<br/>on-chain state] --> RPC[RPC nodes<br/>live reads]
  RPC --> Indexer[s03-indexer<br/>database sync]
  Indexer --> WebApp[web app<br/>TanStack Query]
  WebApp --> Screen[trader screen]
`

  const validSequence = `
sequenceDiagram
  autonumber
  actor Trader
  participant Web as Web App
  participant Router as ExchangeRouter
  participant Vault as OrderVault

  Trader->>Web: Click Submit Order
  Web->>Router: buildCreateOrderTransaction()
  Router->>Vault: Lock collateral
  Vault-->>Web: OrderCreated event
  Web-->>Trader: Toast confirmation
`

  test("parses flowchart AST correctly with directions and node shapes", () => {
    const ast = parseMermaid(validFlowchart, { file: "test.mdx" })
    expect(ast.type).toBe("flowchart")
    if (ast.type === "flowchart") {
      expect(ast.direction).toBe("TD")
      expect(ast.nodes.size).toBe(5)
      expect(ast.nodes.get("Contracts")?.label).toBe(
        "Soroban contracts<br/>on-chain state"
      )
      expect(ast.edges.length).toBe(4)
      expect(ast.edges[0].from).toBe("Contracts")
      expect(ast.edges[0].to).toBe("RPC")
    }
  })

  test("parses sequence diagram AST correctly with actors and messages", () => {
    const ast = parseMermaid(validSequence, { file: "seq.mdx" })
    expect(ast.type).toBe("sequence")
    if (ast.type === "sequence") {
      expect(ast.actors.length).toBe(4)
      expect(ast.actors.find((a) => a.id === "Trader")?.isActor).toBe(true)
      expect(ast.messages.length).toBe(5)
    }
  })

  test("renders dual theme SVGs with token-derived colors and accessible tags", () => {
    const ast = parseMermaid(validFlowchart)
    const result = renderMermaidSvg(
      ast,
      { caption: "Data flow architecture" },
      "dia-1"
    )

    expect(result.lightSvg).toContain("<svg")
    expect(result.darkSvg).toContain("<svg")

    // Verify accessible labels inside SVGs
    expect(result.lightSvg).toContain(
      '<title id="title-dia-1-light">Data flow architecture</title>'
    )
    expect(result.lightSvg).toContain(
      '<desc id="desc-dia-1-light">Data flow architecture</desc>'
    )
    expect(result.darkSvg).toContain(
      '<title id="title-dia-1-dark">Data flow architecture</title>'
    )
    expect(result.darkSvg).toContain(
      '<desc id="desc-dia-1-dark">Data flow architecture</desc>'
    )

    // Verify theme colors differ between light and dark
    // Light node text is dark (#0f172a), dark node text is light (#f8fafc)
    expect(result.lightSvg).toContain('fill="#0f172a"')
    expect(result.darkSvg).toContain('fill="#f8fafc"')

    // Light node fill is white/light (#ffffff), dark node fill is slate (#1e293b)
    expect(result.lightSvg).toContain('fill="#ffffff"')
    expect(result.darkSvg).toContain('fill="#1e293b"')

    // Brand primary arrows (light: #0284c7, dark: #38bdf8)
    expect(result.lightSvg).toContain('fill="#0284c7"')
    expect(result.darkSvg).toContain('fill="#38bdf8"')
  })

  test("renders accessible scrollable figure container", () => {
    const html = renderMermaidFigureHtml(validFlowchart, {
      caption: "Architecture data flow",
      title: "Architecture",
    })

    // Figure landmark and caption connection
    expect(html).toContain('role="figure"')
    expect(html).toContain('aria-labelledby="caption-')
    expect(html).toContain('<figcaption id="caption-')
    expect(html).toContain("Architecture data flow")

    // Scrollable region with tabindex=0 for keyboard accessibility
    expect(html).toContain('class="mermaid-scroll overflow-x-auto')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Diagram content"')

    // Dual theme CSS switching classes
    expect(html).toContain("mermaid-diagram-light block dark:hidden")
    expect(html).toContain("mermaid-diagram-dark hidden dark:block")
  })

  test("fails build when caption is missing", () => {
    const ast = parseMermaid(validFlowchart, { file: "missing-caption.mdx" })
    expect(() => {
      renderMermaidSvg(
        ast,
        { caption: "", file: "missing-caption.mdx" },
        "dia-err"
      )
    }).toThrow("missing a required caption / text alternative")
  })

  test("fails build on malformed diagram syntax with file and parser error", () => {
    const malformedCode = `
graph TD
  A --> [Unclosed bracket
`
    expect(() => {
      parseMermaid(malformedCode, { file: "broken-diagram.mdx" })
    }).toThrow("Mermaid parse error in broken-diagram.mdx")
  })

  test("rehype plugin transforms fenced mermaid code block into figure HAST node", () => {
    const tree: HastRoot = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-mermaid"] },
              data: {
                meta: 'caption="The complete SO4 trading and settlement data flow" title="Architecture Overview"',
              },
              children: [
                {
                  type: "text",
                  value: `graph TD\n  A[Client] --> B[Server]\n  B --> C[(Database)]`,
                },
              ],
            },
          ],
        },
      ],
    }

    const plugin = rehypeMermaid()
    plugin(tree, { path: "architecture.mdx" })

    const figure = tree.children[0]
    expect(figure.tagName).toBe("figure")
    expect(figure.properties?.className).toContain("mermaid-wrapper")
    expect(figure.properties?.role).toBe("figure")

    const scrollDiv = figure.children?.[0]
    expect(scrollDiv?.properties?.className).toContain("mermaid-scroll")
    expect(scrollDiv?.properties?.tabIndex).toBe(0)

    const lightDiv = scrollDiv?.children?.[0]
    const darkDiv = scrollDiv?.children?.[1]
    expect(lightDiv?.properties?.className).toContain("mermaid-diagram-light")
    expect(lightDiv?.properties?.className).toContain("block")
    expect(lightDiv?.properties?.className).toContain("dark:hidden")

    expect(darkDiv?.properties?.className).toContain("mermaid-diagram-dark")
    expect(darkDiv?.properties?.className).toContain("hidden")
    expect(darkDiv?.properties?.className).toContain("dark:block")

    const figcaption = figure.children?.[1]
    expect(figcaption?.tagName).toBe("figcaption")
    expect(figcaption?.children?.[0]?.value).toBe(
      "The complete SO4 trading and settlement data flow"
    )
  })

  test("rehype plugin fails when caption is missing in AST", () => {
    const tree: HastRoot = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-mermaid"] },
              data: { meta: "" },
              children: [
                {
                  type: "text",
                  value: `graph TD\n  A --> B`,
                },
              ],
            },
          ],
        },
      ],
    }

    const plugin = rehypeMermaid()
    expect(() => {
      plugin(tree, { path: "no-caption.mdx" })
    }).toThrow("missing a required caption")
  })
})
