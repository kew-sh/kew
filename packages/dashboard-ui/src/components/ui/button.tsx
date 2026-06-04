import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-[var(--ease-out-quart)] disabled:opacity-45 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        accent: "bg-accent-strong text-accent-ink hover:bg-accent-strong-hover",
        outline: "border border-line-strong text-ink hover:bg-surface",
        ghost: "text-ink-2 hover:text-ink hover:bg-surface",
        subtle: "border border-line bg-surface text-ink hover:bg-overlay hover:border-line-strong",
        danger: "text-failed hover:bg-failed/12",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3",
        icon: "h-8 w-8",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: { variant: "subtle", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { button as buttonVariants };
