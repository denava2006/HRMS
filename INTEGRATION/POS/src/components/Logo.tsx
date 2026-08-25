import logo from "@/assets/sarisync-logo.png";
import { cn } from "@/lib/utils";

/**
 * SariSync brand logo. The source image contains the cart icon + wordmark side-by-side.
 * - variant="full": shows the entire logo (icon + wordmark)
 * - variant="icon": crops to show only the cart icon (left ~32% of the image)
 */
export function Logo({
  variant = "full",
  className,
  height = 40,
}: {
  variant?: "full" | "icon";
  className?: string;
  height?: number;
}) {
  if (variant === "icon") {
    // Original image is ~1500x900, icon occupies left ~32%
    return (
      <div
        className={cn("overflow-hidden inline-block", className)}
        style={{ height, width: height * 0.95 }}
        aria-label="SariSync"
      >
        <img
          src={logo}
          alt="SariSync"
          style={{ height, width: height * 2.97, objectFit: "cover", objectPosition: "left center" }}
          className="select-none"
          draggable={false}
        />
      </div>
    );
  }
  return (
    <img
      src={logo}
      alt="SariSync"
      style={{ height }}
      className={cn("select-none w-auto", className)}
      draggable={false}
    />
  );
}
