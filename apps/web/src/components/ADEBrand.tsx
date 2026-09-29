import { cn } from "../lib/utils";

/** ADE's open-frame A: one mark for the workspace, splash, and app icon. */
export function ADEMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("size-7 shrink-0", className)}
    >
      <path d="M5 26 14.5 6h3L27 26h-5.25L16 13.25 10.25 26H5Z" fill="currentColor" />
      <path d="M12.25 23h7.5v3h-7.5z" fill="currentColor" />
    </svg>
  );
}

export function ADEBrand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <ADEMark />
      <span className={compact ? "sr-only" : "text-lg leading-none font-semibold tracking-tight"}>
        ADE
      </span>
    </span>
  );
}
