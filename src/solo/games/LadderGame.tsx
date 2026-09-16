import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RestaurantThumb } from '@/components/RestaurantThumb';
import { createRandom, seededShuffle } from '@/lib/random';
import { formatDistance } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { CATEGORY_LABEL } from '@/types/restaurant';
import { diversePool } from '@/solo/methods';
import type { SoloGameProps } from './types';

const MAX_LINES = 5;
const ROWS = 7;
/** 가로줄이 생길 확률 */
const RUNG_CHANCE = 0.48;

/** SVG 좌표계 */
const VIEW_W = 100;
const VIEW_H = 124;
const TOP_Y = 10;
const BOTTOM_Y = 112;
const SIDE = 10;

const DRAW_MS = 1_900;

/**
 * 사다리 타기.
 *
 * 결과는 운이지만 룰렛과는 다른 운이다. 내가 고른 줄에서 시작해 길이 그려지는
 * 동안 어디로 갈지 지켜보게 된다 — 그 과정이 게임이다.
 * 사다리 모양은 시드로 고정해서, 고르기 전에 이미 정해져 있다.
 */
export function LadderGame({ candidates, seed, onDecide }: SoloGameProps) {
  const lineCount = Math.min(MAX_LINES, candidates.length);

  const { rungs, prizes } = useMemo(() => {
    const rand = createRandom(seed);
    // rungs[row] = 그 줄에 가로줄이 있는 칸(왼쪽 선의 인덱스)들
    const built: number[][] = [];
    for (let row = 0; row < ROWS; row += 1) {
      const inRow: number[] = [];
      for (let gap = 0; gap < lineCount - 1; gap += 1) {
        // 바로 옆 칸에 이미 가로줄이 있으면 겹쳐서 길이 꼬인다
        if (inRow.includes(gap - 1)) continue;
        if (rand() < RUNG_CHANCE) inRow.push(gap);
      }
      built.push(inRow);
    }
    return {
      rungs: built,
      prizes: seededShuffle(diversePool(candidates, lineCount, seed), seed ^ 0x5a17),
    };
  }, [candidates, lineCount, seed]);

  const [start, setStart] = useState<number | null>(null);
  const [landed, setLanded] = useState<number | null>(null);

  const x = (index: number) =>
    lineCount === 1 ? VIEW_W / 2 : SIDE + (index * (VIEW_W - SIDE * 2)) / (lineCount - 1);
  const rowY = (row: number) => TOP_Y + ((row + 1) * (BOTTOM_Y - TOP_Y)) / (ROWS + 1);

  /** 고른 줄에서 실제로 내려가는 길 */
  const path = useMemo(() => {
    if (start === null) return '';
    let line = start;
    let d = `M ${x(line)} ${TOP_Y}`;
    for (let row = 0; row < ROWS; row += 1) {
      const y = rowY(row);
      d += ` L ${x(line)} ${y}`;
      if (rungs[row].includes(line)) line += 1;
      else if (rungs[row].includes(line - 1)) line -= 1;
      d += ` L ${x(line)} ${y}`;
    }
    d += ` L ${x(line)} ${BOTTOM_Y}`;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, rungs, lineCount]);

  const destination = useMemo(() => {
    if (start === null) return null;
    let line = start;
    for (let row = 0; row < ROWS; row += 1) {
      if (rungs[row].includes(line)) line += 1;
      else if (rungs[row].includes(line - 1)) line -= 1;
    }
    return line;
  }, [start, rungs]);

  const winner = landed !== null ? prizes[landed] : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-sm font-extrabold tracking-[0.18em] text-accent">사다리 타기</p>
        <h2 className="mt-1.5 text-h1 text-white">
          {start === null ? '줄을 하나 고르세요' : winner ? '도착!' : '내려가는 중…'}
        </h2>
      </div>

      {/* 출발선 */}
      <div className="mt-5 flex justify-between px-[6%]">
        {Array.from({ length: lineCount }, (_, i) => (
          <button
            key={i}
            type="button"
            disabled={start !== null}
            onClick={() => setStart(i)}
            aria-label={`${i + 1}번 줄에서 출발`}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-h3 transition-colors ${
              start === i
                ? 'bg-accent text-white'
                : 'bg-white/10 text-white/60 active:bg-white/20 disabled:opacity-30'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* 사다리 */}
      <div className="mt-2 flex-1">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <line
              key={`v${i}`}
              x1={x(i)}
              y1={TOP_Y}
              x2={x(i)}
              y2={BOTTOM_Y}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={1.2}
            />
          ))}
          {rungs.map((inRow, row) =>
            inRow.map((gap) => (
              <line
                key={`h${row}-${gap}`}
                x1={x(gap)}
                y1={rowY(row)}
                x2={x(gap + 1)}
                y2={rowY(row)}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth={1.2}
              />
            )),
          )}

          {path && (
            <motion.path
              d={path}
              fill="none"
              stroke="#FF7A1A"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: DRAW_MS / 1000, ease: 'easeInOut' }}
              onAnimationComplete={() => setLanded(destination)}
            />
          )}
        </svg>
      </div>

      {/* 도착 결과 */}
      <div className="mt-3 min-h-[92px]">
        {winner ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            onClick={() => onDecide(winner, `${(start ?? 0) + 1}번 줄에서 출발해 도착한 곳`)}
            className="flex w-full items-center gap-3 rounded-2xl bg-accent/18 p-3.5 text-left active:bg-accent/26"
          >
            <RestaurantThumb
              category={winner.category}
              name={winner.name}
              className="h-14 w-14 shrink-0 rounded-xl"
              emojiClassName="text-[30px]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-h2 text-white">{winner.name}</p>
              <p className="mt-0.5 text-sm font-semibold text-white/45">
                {CATEGORY_LABEL[winner.category]} · 걸어서{' '}
                {walkingMinutes(winner.distance)}분 · {formatDistance(winner.distance)}
              </p>
            </div>
            <span className="shrink-0 text-sm font-extrabold text-accent-300">여기로 →</span>
          </motion.button>
        ) : (
          <p className="pt-6 text-center text-sm font-semibold text-white/30">
            {start === null
              ? '어느 줄이 어디로 가는지는 아무도 몰라요'
              : '길을 따라가는 중…'}
          </p>
        )}
      </div>
    </div>
  );
}
