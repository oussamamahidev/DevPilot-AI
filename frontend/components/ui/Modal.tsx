"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type ModalProps = {
  children: ReactNode;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
};

export function Modal({ children, footer, isOpen, onClose, title }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 px-3 py-4 sm:px-4 sm:py-6">
      <section className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-md border border-slate-200 bg-white p-4 shadow-xl sm:max-h-[calc(100dvh-3rem)] sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="min-w-0 break-words text-base font-semibold text-slate-950">{title}</h2>
          <Button onClick={onClose} size="sm" variant="ghost">
            Close
          </Button>
        </div>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </section>
    </div>
  );
}
