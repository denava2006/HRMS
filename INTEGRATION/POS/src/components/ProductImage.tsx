import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductImage({
  src,
  name,
  className,
  iconSize = "w-8 h-8",
}: {
  src?: string | null;
  name: string;
  className?: string;
  iconSize?: string;
}) {
  const [errored, setErrored] = useState(false);
  const showImg = src && !errored;
  return (
    <div className={cn("relative bg-gradient-to-br from-secondary to-muted flex items-center justify-center overflow-hidden", className)}>
      {showImg ? (
        <img
          src={src!}
          alt={name}
          loading="lazy"
          onError={() => setErrored(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-primary/40">
          <ImageIcon className={iconSize} strokeWidth={1.5} />
          <span className="font-bold text-xl mt-1">{name.charAt(0).toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}
