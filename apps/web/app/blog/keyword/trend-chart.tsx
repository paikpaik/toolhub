"use client";

import type { TrendPoint } from "@toolhub/collector";
import { useState } from "react";

const WIDTH = 720;
const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 28, left: 32 };
const Y_TICKS = [0, 50, 100];

/** 월별 검색 추이 (상대값 0~100) 단일 시계열 라인 차트. 마우스를 올리면 가장 가까운 달의 값을 보여준다 */
export function TrendChart({ points, title }: { points: TrendPoint[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (ratio: number) => PAD.top + (1 - ratio / 100) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.ratio).toFixed(1)}`).join(" ");
  // X축은 6개월마다 (YY.MM)
  const xTicks = points.map((p, i) => ({ i, label: `${p.month.slice(2, 4)}.${p.month.slice(5, 7)}` })).filter(({ i }) => i % 6 === 0 || i === points.length - 1);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  const active = hover === null ? null : points[hover]!;

  return (
    <figure className="trend-chart">
      <figcaption>{title}</figcaption>
      <div className="trend-plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
          {Y_TICKS.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map(({ i, label }) => (
            // 양 끝 눈금은 바깥으로 잘리지 않게 안쪽으로 정렬한다
            <text key={i} className="tick" x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
              {label}
            </text>
          ))}
          <path className="series" d={path} />
          {active && hover !== null && (
            <g>
              <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} />
              <circle className="dot" cx={x(hover)} cy={y(active.ratio)} r={4} />
            </g>
          )}
          {/* 선이 아니라 영역 전체로 마우스를 받는다 */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {active && hover !== null && (
          <div className="trend-tooltip" style={{ left: `${(x(hover) / WIDTH) * 100}%` }}>
            <strong>{active.month}</strong> {active.ratio}
          </div>
        )}
      </div>
      <details className="trend-table">
        <summary>표로 보기</summary>
        <table>
          <tbody>
            {points.map((p) => (
              <tr key={p.month}>
                <td>{p.month}</td>
                <td className="num">{p.ratio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
