import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Skeleton } from './Skeleton'
import { DUR, EASE_OUT } from '../../lib/motion'

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: DUR.fast, ease: EASE_OUT, delay: Math.min(i, 12) * 0.018 },
  }),
}

/**
 * Sortable table with a sticky header.
 *
 * Columns declare their own alignment and renderer, so the invoice list and
 * later screens share one table rather than each hand-rolling markup.
 */
export function DataTable({
  columns,
  rows,
  getRowKey,
  sort,
  direction,
  onSortChange,
  loading = false,
  skeletonRows = 8,
  caption,
  renderRowActions,
  rowHref,
  /** Caps the scroll region so the header can stick and pagination stays put. */
  maxHeight = 'calc(100dvh - 20rem)',
  className = '',
}) {
  const handleSort = (column) => {
    if (!column.sortable) return
    // First click on a new column uses its natural direction; clicking the
    // active column flips it.
    if (sort === column.key) {
      onSortChange(column.key, direction === 'asc' ? 'desc' : 'asc')
    } else {
      onSortChange(column.key, column.defaultDirection ?? 'asc')
    }
  }

  // The wrapper scrolls in both axes on purpose: `overflow-x` alone would
  // still make it a scroll container, and the header would then stick inside
  // it at an offset instead of to the top of the rows.
  return (
    <div className={`overflow-auto ${className}`} style={{ maxHeight }}>
      <table className="w-full min-w-[56rem] border-collapse text-left">
        {caption && <caption className="sr-only">{caption}</caption>}

        <thead className="sticky top-0 z-20">
          <tr className="border-b border-hairline bg-base-900">
            {columns.map((column) => {
              const active = sort === column.key
              const Icon = !column.sortable
                ? null
                : active
                  ? direction === 'asc'
                    ? ArrowUp
                    : ArrowDown
                  : ChevronsUpDown

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    !column.sortable
                      ? undefined
                      : active
                        ? direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                  }
                  className={`whitespace-nowrap px-3 py-2.5 text-[0.7rem] font-medium uppercase
                              tracking-wider text-ink-muted ${column.align === 'right' ? 'text-right' : ''}`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className={`inline-flex items-center gap-1.5 rounded transition-colors
                                  duration-snap ease-out hover:text-ink-primary
                                  focus-visible:outline-none focus-visible:ring-2
                                  focus-visible:ring-accent focus-visible:ring-offset-2
                                  focus-visible:ring-offset-base-900
                                  ${active ? 'text-ink-primary' : ''}
                                  ${column.align === 'right' ? 'flex-row-reverse' : ''}`}
                    >
                      {column.header}
                      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
            {renderRowActions && <th scope="col" className="w-20 px-3 py-2.5" />}
          </tr>
        </thead>

        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-hairline last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-3">
                      <Skeleton
                        className={`h-3 ${column.align === 'right' ? 'ml-auto w-16' : 'w-24'}`}
                      />
                    </td>
                  ))}
                  {renderRowActions && <td className="px-3 py-3" />}
                </tr>
              ))
            : rows.map((row, i) => (
                <motion.tr
                  key={getRowKey(row)}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                  className="group border-b border-hairline transition-colors duration-snap
                             ease-out last:border-0 hover:bg-base-800/60"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-3 align-middle ${column.align === 'right' ? 'text-right' : ''} ${column.cellClassName ?? ''}`}
                    >
                      {column.render(row, { href: rowHref?.(row) })}
                    </td>
                  ))}
                  {renderRowActions && (
                    <td className="px-3 py-3 text-right">{renderRowActions(row)}</td>
                  )}
                </motion.tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
