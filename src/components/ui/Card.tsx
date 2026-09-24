import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ className = "", interactive = false, children, ...rest }: CardProps) {
  return (
    <div
      className={`border border-base-700 bg-base-900 ${
        interactive ? "transition-colors duration-150 hover:border-brand-500" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
