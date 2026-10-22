'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

const CELL_SIZE = 48
/** Cells within this distance, in cells, of the click ripple. */
const RIPPLE_RADIUS = 15
/** Each cell one cell further from the click starts its ripple this many seconds later. */
const RIPPLE_STEP_SECONDS = 0.05

interface Ripple {
  readonly id: number
  readonly left: number
  readonly top: number
  readonly delaySeconds: number
}

export function BackgroundRipple() {
  const containerRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  // A click replaces the list with new ids, so React mounts the cells afresh and each ripple starts over.
  const [ripples, setRipples] = useState<Ripple[]>([])
  const nextRippleId = useRef(0)

  useEffect(() => {
    const parent = containerRef.current?.parentElement
    if (!parent) return

    const onMove = (e: MouseEvent) => {
      if (!containerRef.current || !spotlightRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const mask = `radial-gradient(120px circle at ${x}px ${y}px, rgba(0,0,0,0.8), transparent)`
      spotlightRef.current.style.maskImage = mask
    }

    parent.addEventListener('mousemove', onMove)
    return () => parent.removeEventListener('mousemove', onMove)
  }, [])

  const handleClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const clickCol = Math.floor((e.clientX - rect.left) / CELL_SIZE)
    const clickRow = Math.floor((e.clientY - rect.top) / CELL_SIZE)
    const rows = Math.ceil(rect.height / CELL_SIZE) + 1
    const cols = Math.ceil(rect.width / CELL_SIZE) + 1

    const next: Ripple[] = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const distance = Math.sqrt((clickRow - row) ** 2 + (clickCol - col) ** 2)
        if (distance > RIPPLE_RADIUS) continue

        next.push({
          id: nextRippleId.current++,
          left: col * CELL_SIZE,
          top: row * CELL_SIZE,
          delaySeconds: distance * RIPPLE_STEP_SECONDS,
        })
      }
    }
    setRipples(next)
  }, [])

  const gridLine = 'rgba(31, 31, 35, 0.4)'
  const accentLine = 'rgba(0, 255, 162, 0.3)'

  const baseGrid = [
    `repeating-linear-gradient(0deg, transparent, transparent ${CELL_SIZE - 1}px, ${gridLine} ${CELL_SIZE - 1}px, ${gridLine} ${CELL_SIZE}px)`,
    `repeating-linear-gradient(90deg, transparent, transparent ${CELL_SIZE - 1}px, ${gridLine} ${CELL_SIZE - 1}px, ${gridLine} ${CELL_SIZE}px)`,
  ].join(', ')

  const accentGrid = [
    `repeating-linear-gradient(0deg, transparent, transparent ${CELL_SIZE - 1}px, ${accentLine} ${CELL_SIZE - 1}px, ${accentLine} ${CELL_SIZE}px)`,
    `repeating-linear-gradient(90deg, transparent, transparent ${CELL_SIZE - 1}px, ${accentLine} ${CELL_SIZE - 1}px, ${accentLine} ${CELL_SIZE}px)`,
  ].join(', ')

  return (
    <div
      ref={containerRef}
      role="presentation"
      onClick={handleClick}
      className="absolute inset-0 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, black 40%, transparent 85%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 85%)',
      }}
    >
      {/* Base grid lines */}
      <div className="absolute inset-0" style={{ background: baseGrid }} />

      {/* Accent grid lines - spotlight follows mouse */}
      <div
        ref={spotlightRef}
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: accentGrid,
          maskImage:
            'radial-gradient(120px circle at -9999px -9999px, rgba(0,0,0,0.8), transparent)',
          WebkitMaskImage:
            'radial-gradient(120px circle at -9999px -9999px, rgba(0,0,0,0.8), transparent)',
        }}
      />

      {/* Ripple cells, invisible until a click animates them */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {ripples.map((ripple) => (
          <div
            key={ripple.id}
            className="absolute opacity-0"
            style={{
              left: ripple.left,
              top: ripple.top,
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: 'rgba(0, 255, 162, 0.12)',
              animation: `cell-ripple 0.8s ease-out ${ripple.delaySeconds}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
