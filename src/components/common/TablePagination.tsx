"use client";

import React from "react";

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  itemLabel: string;
  zeroLabel?: string;
  containerClass?: string;
  onPageChange: (page: number) => void;
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  itemLabel,
  zeroLabel,
  containerClass,
  onPageChange,
}: TablePaginationProps) {
  if (totalItems === 0) {
    return (
      <div
        className={
          containerClass ||
          "px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
        }
      >
        <div className="text-slate-500 font-medium">
          {zeroLabel || `Menampilkan 0 ${itemLabel}`}
        </div>
        <div className="flex items-center gap-1"></div>
      </div>
    );
  }

  const startIdx = (currentPage - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, totalItems);

  // Generate pagination items with ellipses matching ExamLANPro
  const pageItems: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pageItems.push(i);
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      if (pageItems[pageItems.length - 1] !== "...") {
        pageItems.push("...");
      }
    }
  }

  return (
    <div
      className={
        containerClass ||
        "px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
      }
    >
      <div className="text-slate-500 font-medium">
        Menampilkan {startIdx + 1} - {endIdx} dari {totalItems} {itemLabel}
      </div>
      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          title="Sebelumnya"
        >
          <i className="fa-solid fa-chevron-left text-[10px]"></i>
        </button>

        {/* Numeric Page Buttons */}
        {pageItems.map((item, index) => {
          if (item === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="w-7 text-center text-slate-400 text-xs select-none"
              >
                ...
              </span>
            );
          }
          const isActive = item === currentPage;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg border text-xs transition cursor-pointer ${
                isActive
                  ? "bg-brand-600 text-white font-bold border-brand-600 shadow-2xs"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          title="Selanjutnya"
        >
          <i className="fa-solid fa-chevron-right text-[10px]"></i>
        </button>
      </div>
    </div>
  );
}
