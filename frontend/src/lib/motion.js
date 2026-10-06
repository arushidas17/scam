// Shared motion vocabulary. Every animation in the app pulls its durations and
// easing from here so the landing page and the dashboard move the same way.

export const EASE_OUT = [0.16, 1, 0.3, 1]

export const DUR = {
  snap: 0.18,
  fast: 0.3,
  base: 0.45,
  slow: 0.7,
}

/** Section wrapper: fades and rises, and staggers its children. */
export const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

/** Child of a staggered container: rises ~20px as it fades in. */
export const riseVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE_OUT },
  },
}

/** Same as riseVariants but for standalone elements with no parent container. */
export const riseOnce = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: DUR.base, ease: EASE_OUT },
}

/** Viewport config used by every scroll-triggered section. */
export const VIEWPORT = { once: true, amount: 0.25 }

/** Subtle press feedback shared by buttons. */
export const pressable = {
  whileTap: { scale: 0.975 },
  transition: { duration: DUR.snap, ease: EASE_OUT },
}
