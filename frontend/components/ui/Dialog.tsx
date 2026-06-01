"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toneClasses, type StatusTone } from "@/components/ui/StatusBadge";

type ActionVariant = "primary" | "secondary" | "danger" | "ghost";

export type DialogAction = {
  label: string;
  onClick: () => void;
  variant?: ActionVariant;
  isLoading?: boolean;
  disabled?: boolean;
};

type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Accent for the optional header icon badge. */
  tone?: StatusTone;
  icon?: ReactNode;
  children?: ReactNode;
  /** Primary action (rendered on the right of the footer). */
  confirm?: DialogAction;
  /** Secondary action. Defaults to a "Cancel" button calling onClose. */
  cancel?: DialogAction | null;
  /** Fully custom footer — overrides confirm/cancel. */
  footer?: ReactNode;
};

/**
 * General-purpose dialog built on {@link Modal}. Use for confirm / alert /
 * prompt flows. For the common destructive-confirm case prefer
 * {@link ConfirmDialog}, which is a thin preset over this component.
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  tone,
  icon,
  children,
  confirm,
  cancel,
  footer,
}: DialogProps) {
  const resolvedFooter =
    footer ??
    (confirm || cancel !== null ? (
      <>
        <Button
          onClick={cancel?.onClick ?? onClose}
          variant={cancel?.variant ?? "secondary"}
          disabled={cancel?.disabled}
        >
          {cancel?.label ?? "Cancel"}
        </Button>
        {confirm ? (
          <Button
            onClick={confirm.onClick}
            variant={confirm.variant ?? "primary"}
            isLoading={confirm.isLoading}
            disabled={confirm.disabled}
          >
            {confirm.label}
          </Button>
        ) : null}
      </>
    ) : undefined);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={resolvedFooter}>
      <div className="flex min-w-0 gap-3">
        {icon ? (
          <span
            aria-hidden="true"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${toneClasses[tone ?? "neutral"]}`}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {description ? <p className="text-sm leading-6 text-fg-muted">{description}</p> : null}
          {children ? <div className={description ? "mt-3" : ""}>{children}</div> : null}
        </div>
      </div>
    </Modal>
  );
}
