"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 반응형 데이터 테이블 — 데스크톱은 <table>, 모바일(sm 미만)은 카드 스택.
 * 어드민 문의/에러 목록 등에 사용. 컬럼 정의 기반.
 */
export interface Column<Row> {
  /** 헤더 라벨 */
  header: React.ReactNode;
  /** 셀 렌더러 */
  cell: (row: Row) => React.ReactNode;
  /** 모바일 카드에서 라벨 숨김(예: 제목 행) */
  hideMobileLabel?: boolean;
  className?: string;
  /** 우측 정렬 등 */
  align?: "left" | "right" | "center";
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  onRowClick?: (row: Row) => void;
  /** 빈 상태 노드 */
  empty?: React.ReactNode;
  caption?: string;
  className?: string;
}

const alignClass = (a?: "left" | "right" | "center") =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  caption,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0 && empty) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 데스크톱 — 테이블 */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {columns.map((col, i) => (
                <th
                  key={i}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    alignClass(col.align),
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={rowKey(row, ri)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                className={cn(
                  "border-b border-border/70 last:border-0",
                  onRowClick &&
                    "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                )}
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      "px-4 py-3 align-middle",
                      alignClass(col.align),
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 — 카드 스택 */}
      <div className="space-y-2.5 sm:hidden">
        {rows.map((row, ri) => {
          const inner = (
            <div className="space-y-1.5">
              {columns.map((col, ci) => (
                <div
                  key={ci}
                  className={cn(
                    "flex items-baseline justify-between gap-3",
                    col.hideMobileLabel && "block",
                  )}
                >
                  {!col.hideMobileLabel ? (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {col.header}
                    </span>
                  ) : null}
                  <span className="min-w-0 text-sm">{col.cell(row)}</span>
                </div>
              ))}
            </div>
          );
          return onRowClick ? (
            <button
              key={rowKey(row, ri)}
              type="button"
              onClick={() => onRowClick(row)}
              className="block w-full rounded-xl border border-border bg-card p-4 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {inner}
            </button>
          ) : (
            <div
              key={rowKey(row, ri)}
              className="rounded-xl border border-border bg-card p-4"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
