import * as React from 'react'

/**
 * FLIP animations for stable, keyed live lists. React removes rows immediately
 * for accessibility; inert visual ghosts animate exits without intercepting
 * pointer or keyboard input. Only opacity and transform are animated.
 */
export function useAnimatedRows<T>(
  data: Array<T>,
  keyExtractor: (row: T) => string,
  enabled = true,
  isLoading = false,
) {
  const currentNodes = React.useRef(new Map<string, HTMLElement>())
  const previousRows = React.useRef(
    new Map<string, { rect: DOMRect; node: HTMLElement; widths: Array<number> }>(),
  )
  const initialized = React.useRef(false)

  React.useLayoutEffect(() => {
    if (!enabled || isLoading) {
      previousRows.current.clear()
      initialized.current = false
      return
    }
    const old = previousRows.current
    const next = new Map<string, { rect: DOMRect; node: HTMLElement; widths: Array<number> }>()
    const css = getComputedStyle(document.documentElement)
    const duration = Number.parseFloat(css.getPropertyValue('--duration-moderate')) || 200
    const easing = css.getPropertyValue('--ease-out').trim() || 'ease-out'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.reducedMotion === 'true'

    for (const row of data) {
      const key = keyExtractor(row)
      const node = currentNodes.current.get(key)
      if (!node) continue
      const rect = node.getBoundingClientRect()
      next.set(key, {
        rect,
        node,
        widths: Array.from(node.children, cell => cell.getBoundingClientRect().width),
      })
      if (!initialized.current || reduced) continue
      const previous = old.get(key)
      const dy = previous ? previous.rect.top - rect.top : 10
      if (!previous || Math.abs(dy) > 1) {
        // Web Animations interrupts from current compositor state instead of
        // replaying a CSS keyframe when live data changes during an animation.
        node.getAnimations().forEach(animation => animation.cancel())
        node.animate(
          [
            { transform: `translateY(${dy}px)`, opacity: previous ? 1 : 0 },
            { transform: 'translateY(0)', opacity: 1 },
          ],
          { duration, easing },
        )
      }
    }

    // Exiting rows are inert visual ghosts: the DOM table is updated
    // immediately for accessibility while the remaining rows FLIP into place.
    if (initialized.current && !reduced) {
      for (const [key, previous] of old) {
        if (next.has(key) || previous.rect.bottom < 0 || previous.rect.top > innerHeight) continue
        const ghost = document.createElement('table')
        const body = document.createElement('tbody')
        const clone = previous.node.cloneNode(true) as HTMLElement
        Array.from(clone.children).forEach((cell, index) => {
          ;(cell as HTMLElement).style.width = `${previous.widths[index]}px`
        })
        if (clone.tagName === 'TR') {
          body.append(clone)
          ghost.append(body)
        } else {
          // Mobile order cards are block elements rather than table rows.
          const wrapper = document.createElement('tbody')
          const holder = document.createElement('tr')
          const cell = document.createElement('td')
          cell.append(clone)
          holder.append(cell)
          wrapper.append(holder)
          ghost.append(wrapper)
        }
        ghost.setAttribute('aria-hidden', 'true')
        ghost.inert = true
        Object.assign(ghost.style, {
          position: 'fixed',
          left: `${previous.rect.left}px`,
          top: `${previous.rect.top}px`,
          width: `${previous.rect.width}px`,
          tableLayout: 'fixed',
          pointerEvents: 'none',
          zIndex: '50',
        })
        document.body.append(ghost)
        const animation = ghost.animate(
          [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-8px)' }],
          { duration, easing },
        )
        void animation.finished.finally(() => ghost.remove()).catch(() => ghost.remove())
      }
    }
    previousRows.current = next
    initialized.current = true
  }, [data, enabled, isLoading, keyExtractor])

  return (key: string, node: HTMLElement | null) => {
    if (node) currentNodes.current.set(key, node)
    else currentNodes.current.delete(key)
  }

}
