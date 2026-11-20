"use client";

import React, { useEffect, useState } from "react";

export type DialogOptions = {
  type: "alert" | "confirm";
  title: string;
  message: string;
  cancelText?: string;
  okText?: string;
  isDanger?: boolean;
  resolve: (value: boolean) => void;
};

let setGlobalDialog: ((dialog: DialogOptions | null) => void) | null = null;

export function appAlert(message: string, title = "Informasi"): Promise<boolean> {
  return new Promise((resolve) => {
    if (setGlobalDialog) {
      setGlobalDialog({
        type: "alert",
        title,
        message,
        resolve: (val) => {
          setGlobalDialog?.(null);
          resolve(val);
        },
      });
    } else {
      if (typeof window !== "undefined") {
        window.alert(`${title}\n\n${message}`);
      }
      resolve(true);
    }
  });
}

export function appConfirm(
  message: string,
  title = "Konfirmasi",
  cancelText = "Batal",
  okText = "Ya, Lanjutkan"
): Promise<boolean> {
  const isDanger =
    okText.toLowerCase().includes("hapus") ||
    okText.toLowerCase().includes("reset") ||
    okText.toLowerCase().includes("keluar") ||
    okText.toLowerCase().includes("kumpulkan") ||
    okText.toLowerCase().includes("bersihkan");

  return new Promise((resolve) => {
    if (setGlobalDialog) {
      setGlobalDialog({
        type: "confirm",
        title,
        message,
        cancelText,
        okText,
        isDanger,
        resolve: (val) => {
          setGlobalDialog?.(null);
          resolve(val);
        },
      });
    } else {
      if (typeof window !== "undefined") {
        const res = window.confirm(`${title}\n\n${message}`);
        resolve(res);
      } else {
        resolve(false);
      }
    }
  });
}

export function AppDialogContainer() {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  useEffect(() => {
    setGlobalDialog = setDialog;
    return () => {
      setGlobalDialog = null;
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dialog.resolve(false);
      } else if (e.key === "Enter" && dialog.type === "alert") {
        dialog.resolve(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialog]);

  if (!dialog) return null;

  const isHtml = typeof dialog.message === "string" && /<[a-z][\s\S]*>/i.test(dialog.message);

  const formattedMsg = isHtml ? (
    <div
      id="core-dialog-message-html"
      className="text-xs text-slate-600 mt-1.5 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: dialog.message }}
    />
  ) : dialog.message.includes("\n") ? (
    <div id="core-dialog-message-text" className="text-xs text-slate-600 mt-1.5 leading-relaxed">
      {dialog.message.split("\n").map((line, i) => (
        <React.Fragment key={i}>
          {line}
          <br />
        </React.Fragment>
      ))}
    </div>
  ) : (
    <div id="core-dialog-message-text" className="text-xs text-slate-600 mt-1.5 leading-relaxed">
      {dialog.message}
    </div>
  );

  return (
    <div
      id={dialog.type === "alert" ? "core-app-alert-modal" : "core-app-confirm-modal"}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[99999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (dialog.type === "alert") dialog.resolve(true);
          else dialog.resolve(false);
        }
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg ${
              dialog.type === "alert"
                ? "bg-brand-50 text-brand-600"
                : dialog.isDanger
                ? "bg-rose-50 text-rose-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            <i
              className={`fa-solid ${
                dialog.type === "alert" ? "fa-circle-info" : "fa-triangle-exclamation"
              }`}
            ></i>
          </div>
          <div className="flex-1 min-w-0">
            <h4 id="core-dialog-title" className="font-bold text-slate-800 text-sm">
              {dialog.title}
            </h4>
            {formattedMsg}
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
          {dialog.type === "confirm" && (
            <button
              id="core-confirm-cancel-btn"
              type="button"
              onClick={() => dialog.resolve(false)}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              {dialog.cancelText || "Batal"}
            </button>
          )}
          <button
            id={dialog.type === "alert" ? "core-alert-ok-btn" : "core-confirm-ok-btn"}
            type="button"
            autoFocus
            onClick={() => dialog.resolve(true)}
            className={`px-4 py-1.5 text-white rounded-xl text-xs font-bold transition cursor-pointer ${
              dialog.type === "alert"
                ? "bg-brand-600 hover:bg-brand-700"
                : dialog.isDanger
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {dialog.okText || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
