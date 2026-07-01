type LogoMarkProps = {
  size?: number;
  className?: string;
};

/**
 * Ragify logo — "Retrieval" concept.
 * Connected vector nodes inside a rounded square. Theme-aware via CSS vars:
 * square uses --fg, plain nodes use --bg, highlighted nodes use --accent.
 */
export function LogoMark({ size = 28, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect width="48" height="48" rx="12" fill="var(--fg)" />
      <path
        d="M17 17 31 19M17 17l2 14M31 19l-1 11M19 31l11-1"
        stroke="var(--bg)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="17" cy="17" r="3" fill="var(--accent)" />
      <circle cx="31" cy="19" r="3" fill="var(--bg)" />
      <circle cx="19" cy="31" r="3" fill="var(--bg)" />
      <circle cx="30" cy="30" r="3.5" fill="var(--accent)" />
    </svg>
  );
}
