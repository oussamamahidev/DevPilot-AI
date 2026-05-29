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
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 disabled:text-white",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
  primary:
    "bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-white",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
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
      className={`inline-flex max-w-full items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {isLoading ? (
        <span className="h-2 w-2 rounded-full bg-current motion-safe:animate-pulse" />
      ) : null}
      {children}
    </button>
  );
}
