'use client';

import React, { useMemo, useId } from 'react';
import { toBN } from '@padupos/shared';
import { formatMoneyString, formatDecimalString } from '@/lib/format';
import { seriesHasActivity, formatReadableDate } from '@/lib/dateRange';

export interface SeriesPoint {
  date: string;
  sales: string;
  revenue: string;
  grossProfit: string;
  transactions: number;
}

interface SalesTrendProps {
  points: SeriesPoint[];
  currency: string;
  /** Which series to plot. Defaults to daily revenue. */
  metric?: 'sales' | 'revenue' | 'grossProfit';
}

const WIDTH = 720;
const HEIGHT = 200;
const PADDING = { top: 12, right: 8, bottom: 24, left: 8 };

/**
 * Dependency-free daily trend line for `GET /dashboard/metrics/series`.
 *
 * Design constraints (locked visual language): data-first, no gradients or drop
 * shadows, hairline strokes, tabular figures, and a table fallback that screen
 * readers and no-JS/empty-data states can use directly. There is no animation on the
 * path itself — motion lives in the CSS `grow` rules elsewhere in the app — so the
 * chart respects reduced-motion without extra work.
 *
 * Every plotted value is a backend-provided decimal string. Y-scaling uses BigNumber
 * for the min/max comparison and only converts to a pixel coordinate at the last
 * step, so no financial figure passes through float arithmetic.
 */
export function SalesTrendChart({ points, currency, metric = 'revenue' }: SalesTrendProps) {
  const gradientId = useId();

  const METRIC_LABEL: Record<typeof metric, string> = {
    sales: 'Penjualan',
    revenue: 'Pendapatan',
    grossProfit: 'Laba kotor',
  };
  const label = METRIC_LABEL[metric];

  const geometry = useMemo(() => {
    if (points.length === 0) return null;

    const values = points.map((point) => toBN(point[metric]));
    const hasActivity = seriesHasActivity(points);

    const maxValue = values.reduce(
      (acc, value) => (value.isGreaterThan(acc) ? value : acc),
      toBN(0),
    );

    // A flat-zero window still deserves an axis, so fall back to a nominal scale
    // rather than dividing by zero.
    const ceiling = maxValue.isZero() ? toBN(1) : maxValue;
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

    const coordinates = values.map((value, index) => {
      const ratio = value.isNegative() ? toBN(0) : value.dividedBy(ceiling);
      const clamped = ratio.isGreaterThan(1) ? toBN(1) : ratio;
      return {
        x: PADDING.left + stepX * index,
        y: PADDING.top + plotHeight - clamped.toNumber() * plotHeight,
        value: points[index][metric],
        date: points[index].date,
      };
    });

    const line = coordinates
      .map((coordinate, index) => `${index === 0 ? 'M' : 'L'}${coordinate.x.toFixed(2)},${coordinate.y.toFixed(2)}`)
      .join(' ');

    const baseline = PADDING.top + plotHeight;
    const area = coordinates.length
      ? `${line} L${coordinates[coordinates.length - 1].x.toFixed(2)},${baseline} L${coordinates[0].x.toFixed(2)},${baseline} Z`
      : '';

    // Label roughly six dates regardless of window length.
    const labelStride = Math.max(1, Math.ceil(points.length / 6));

    return { coordinates, line, area, baseline, hasActivity, labelStride, max: maxValue.toFixed(4) };
  }, [points, metric]);

  if (!geometry || points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Rentang ini belum memiliki data harian untuk digambar.
      </p>
    );
  }

  return (
    <figure className="space-y-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-700">{label} harian</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          Puncak {formatMoneyString(geometry.max, { currency })}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        role="presentation"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={PADDING.left}
          y1={geometry.baseline}
          x2={WIDTH - PADDING.right}
          y2={geometry.baseline}
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        {geometry.hasActivity && (
          <>
            <path d={geometry.area} fill={`url(#${gradientId})`} />
            <path
              d={geometry.line}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {geometry.coordinates.map((coordinate) => (
              <circle
                key={coordinate.date}
                cx={coordinate.x}
                cy={coordinate.y}
                r="2"
                fill="#1e293b"
                className="motion-safe:animate-[grow_400ms_ease-out]"
              />
            ))}
          </>
        )}

        {geometry.coordinates.map((coordinate, index) =>
          index % geometry.labelStride === 0 ? (
            <text
              key={`label-${coordinate.date}`}
              x={coordinate.x}
              y={HEIGHT - 6}
              textAnchor={index === 0 ? 'start' : 'middle'}
              className="fill-slate-400 text-[10px]"
            >
              {formatReadableDate(coordinate.date).replace(/ \d{4}$/, '')}
            </text>
          ) : null
        )}
      </svg>

      {/* Accessible equivalent of the drawing above. */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-slate-700 focus-visible:outline-none">
          Lihat data harian
        </summary>
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full border-collapse text-left tabular-nums">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Tanggal
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                  Penjualan
                </th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                  Laba kotor
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Transaksi
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal text-slate-700">
                    {formatReadableDate(point.date)}
                  </th>
                  <td className="py-1.5 pr-3 text-right text-slate-900">
                    {formatMoneyString(point.sales, { currency })}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-slate-900">
                    {formatDecimalString(point.grossProfit)}
                  </td>
                  <td className="py-1.5 text-right text-slate-700">{point.transactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}