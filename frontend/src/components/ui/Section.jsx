import { motion } from 'framer-motion'
import { sectionVariants, riseVariants, VIEWPORT } from '../../lib/motion'

/**
 * Scroll-revealed section. Fades in and staggers its `Rise` children.
 * Framer Motion already respects prefers-reduced-motion for these via the
 * MotionConfig set in App, so no branching is needed here.
 */
export function Section({ id, className = '', children, labelledBy, ...props }) {
  return (
    <motion.section
      id={id}
      aria-labelledby={labelledBy}
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className={className}
      {...props}
    >
      {children}
    </motion.section>
  )
}

/** A staggered child: fades and rises 20px. */
export function Rise({ as = 'div', className = '', children, ...props }) {
  const Comp = motion[as] ?? motion.div
  return (
    <Comp variants={riseVariants} className={className} {...props}>
      {children}
    </Comp>
  )
}

/** Eyebrow + heading + optional lede, used by most sections. */
export function SectionHeading({ eyebrow, title, lede, id, align = 'left', className = '' }) {
  const centered = align === 'center'
  return (
    <div
      className={[
        centered ? 'mx-auto max-w-prose text-center' : 'max-w-prose',
        className,
      ].join(' ')}
    >
      {eyebrow && (
        <Rise as="p" className="eyebrow mb-3">
          {eyebrow}
        </Rise>
      )}
      <Rise as="h2" id={id} className="text-display-md text-ink-primary">
        {title}
      </Rise>
      {lede && (
        <Rise as="p" className="mt-4 text-[1.02rem] leading-relaxed text-ink-secondary">
          {lede}
        </Rise>
      )}
    </div>
  )
}
