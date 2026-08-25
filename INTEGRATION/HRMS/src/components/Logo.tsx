import { cn } from '@/lib/utils'
import wordmarkSrc from '@/assets/harmony-logo.png'
import markSrc from '@/assets/harmony-mark.png'

/** The full "Harmony" wordmark.
 *
 * The letterforms are navy through blue, which reads well on white and on the
 * light page background but disappears on the dark navy footer — use
 * {@link HarmonyMark} there instead, since half of the monogram is bright blue
 * and stays legible against it.
 *
 * Height is what's set; width follows the artwork's own ratio, so the mark
 * can't be squashed by a container.
 */
export function HarmonyWordmark({ className }: { className?: string }) {
  return (
    <img
      src={wordmarkSrc}
      alt="Harmony Suite"
      className={cn('w-auto select-none', className)}
      // Intrinsic size, so the row doesn't reflow once the image decodes.
      width={720}
      height={167}
      draggable={false}
    />
  )
}

/** The H monogram on its own, for square slots — favicon, auth cards, and
 * anywhere the wordmark would be too wide to read. */
export function HarmonyMark({ className }: { className?: string }) {
  return (
    <img
      src={markSrc}
      alt=""
      aria-hidden="true"
      className={cn('select-none', className)}
      width={256}
      height={256}
      draggable={false}
    />
  )
}
