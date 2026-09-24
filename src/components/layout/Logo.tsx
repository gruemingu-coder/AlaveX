interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: 22, text: "text-base" },
  md: { icon: 28, text: "text-xl" },
  lg: { icon: 40, text: "text-3xl" },
};

/**
 * Original AlaveX mark: a square copper stamp with a cut corner and a
 * single-stroke A. Not derived from any third-party logo.
 */
export function Logo({ size = "md", showWordmark = true, className = "" }: LogoProps) {
  const { icon, text } = sizeMap[size];
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M0 0H48L64 16V64H0V0Z" fill="rgb(var(--color-brand-600))" />
        <path
          d="M20 48L32 16L44 48"
          stroke="rgb(var(--color-heading))"
          strokeWidth="5"
          strokeLinejoin="miter"
        />
        <path d="M24 36H40" stroke="rgb(var(--color-heading))" strokeWidth="5" />
      </svg>
      {showWordmark && (
        <span className={`font-semibold tracking-tight text-heading ${text}`}>
          Alave<span className="text-brand-400">X</span>
        </span>
      )}
    </div>
  );
}
