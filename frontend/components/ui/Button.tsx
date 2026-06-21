import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isLoading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "bg-transparent text-fg-muted hover:bg-hover hover:text-fg",
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "border border-line bg-surface text-fg hover:bg-hover",
};

const sizeClasses: Record<ButtonSize, string> = {
  lg: "h-11 px-5 text-sm",
  md: "h-10 px-4 text-sm",
  sm: "h-9 px-3 text-sm",
};

export function Button({
  children,
  className = "",
  disabled,
  isLoading = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || isLoading}
      className={`inline-flex max-w-full items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {isLoading ? (
        <span className="h-2 w-2 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
