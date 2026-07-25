"use client";

import { Fragment, useMemo, useState } from "react";
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiInfo,
  FiSkipForward,
  FiXCircle,
} from "react-icons/fi";
import { useI18n } from "@/lib/i18n/useI18n";
import { QuestionActionBar } from "./QuestionActionBar";
import type { SubmissionResponse } from "@/lib/apiTypes";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";

interface GoBoardQuestionProps {
  stageIndex?: number;
  totalStages?: number;
  stageLabel?: string;
  topic?: string;
  difficulty?: "low" | "medium" | "high" | null;
  recommendedDurationMinutes?: number | null;
  description?: string;
  question: string;
  board: unknown;
  variantLabel: string;
  explanation?: string;
  componentType?: string;
  expectedAnswer?: string | null;
  playerColor?: string | null;
  onComplete?: (answer: string) => Promise<SubmissionResponse | void> | void;
  onError?: (answer: string) => void;
  onCorrectAdvance?: () => void;
  onWrongAdvance?: () => void;
  onSkip?: () => void;
  onHintUse?: () => void;
  hideChrome?: boolean;
}

function parseBoardData(board: unknown): { rows: string[][]; size: number; markPoints: string[] } {
  const normalizeRow = (value: unknown): string[] => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return [];
      }

      if (/[\s,|]+/.test(trimmed)) {
        return trimmed.split(/[\s,|]+/).filter(Boolean);
      }

      return Array.from(trimmed).filter((char) => char !== " ");
    }

    if (Array.isArray(value)) {
      return value.map((entry) => String(entry)).filter(Boolean);
    }

    return [];
  };

  if (Array.isArray(board)) {
    const rows = board.map((entry) => normalizeRow(entry));
    const size = Math.max(9, ...rows.map((row) => row.length), rows.length);
    return { rows, size, markPoints: [] };
  }

  if (board && typeof board === "object") {
    const size = (board as { size?: number }).size || 9;
    const black = (board as { black?: string[] }).black || [];
    const white = (board as { white?: string[] }).white || [];
    const marks = (board as { marks?: string[] }).marks || [];
    const maybeRows = (board as { rows?: unknown }).rows;

    if (Array.isArray(maybeRows)) {
      const boardRows = maybeRows.map((entry) => normalizeRow(entry));
      const markPoints = Array.isArray((board as { marks?: unknown }).marks)
        ? (board as { marks: unknown[] }).marks.map((entry) => String(entry))
        : [];
      const actualSize = Math.max(size, ...boardRows.map((row) => row.length), boardRows.length);
      return { rows: boardRows, size: actualSize, markPoints };
    } else if (Array.isArray(black) || Array.isArray(white)) {
      const rows: string[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ".")
      );

      const coordToIdx = (coord: string) => {
        if (!coord || coord.length < 2) return null;
        const match = coord.trim().toUpperCase().match(/^([A-Z])(\d+)$/);
        if (!match) return null;
        const colLetter = match[1];
        const rowNum = parseInt(match[2], 10);
        const colIndex = colLetter.charCodeAt(0) - 65;
        const rowIndex = size - rowNum;
        return { rowIndex, colIndex };
      };

      black.forEach((coord) => {
        const idx = coordToIdx(coord);
        if (idx && idx.rowIndex >= 0 && idx.rowIndex < size && idx.colIndex >= 0 && idx.colIndex < size) {
          rows[idx.rowIndex][idx.colIndex] = "B";
        }
      });

      white.forEach((coord) => {
        const idx = coordToIdx(coord);
        if (idx && idx.rowIndex >= 0 && idx.rowIndex < size && idx.colIndex >= 0 && idx.colIndex < size) {
          rows[idx.rowIndex][idx.colIndex] = "W";
        }
      });

      const markPoints: string[] = [];
      marks.forEach((coord) => {
        markPoints.push(coord.trim().toUpperCase());
        const idx = coordToIdx(coord);
        if (idx && idx.rowIndex >= 0 && idx.rowIndex < size && idx.colIndex >= 0 && idx.colIndex < size) {
          if (rows[idx.rowIndex][idx.colIndex] === ".") {
            rows[idx.rowIndex][idx.colIndex] = "X";
          }
        }
      });

      return { rows, size, markPoints };
    }
  }

  return { rows: [], size: 9, markPoints: [] };
}

function toCoordinate(rowIndex: number, colIndex: number, size: number) {
  const file = String.fromCharCode(65 + colIndex);
  return `${file}${size - rowIndex}`;
}

const MARK_TOKENS = new Set(["X", "x"]);

const BLACK_STONE_STYLE = "bg-[radial-gradient(circle_at_32%_28%,#5a5a5a,#0a0a0a)]";
const WHITE_STONE_STYLE =
  "bg-[radial-gradient(circle_at_32%_28%,#ffffff,#d9d9d9)] border border-neutral-400/70";

/** Normalize a colour token ("W"/"white"/"白"…, "B"/"black"/"黑"…) to "B" | "W". */
function normalizeColorToken(raw: unknown): "B" | "W" | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value === "w" || value === "white" || value === "白" || value === "白棋") return "W";
  if (value === "b" || value === "black" || value === "黑" || value === "黑棋") return "B";
  return null;
}

/**
 * Colour of the stone the learner is about to place on a "choose a point"
 * question. Honours an explicit hint (data.playerColor) or a board field
 * (player/toPlay/turn) and otherwise defaults to black — capture/tesuji
 * questions have Black playing onto White.
 */
function resolvePlayColor(hint: string | null | undefined, board: unknown): "B" | "W" {
  const fromHint = normalizeColorToken(hint);
  if (fromHint) return fromHint;
  if (board && typeof board === "object") {
    const fromBoard = normalizeColorToken(
      (board as { player?: unknown }).player ??
        (board as { toPlay?: unknown }).toPlay ??
        (board as { turn?: unknown }).turn
    );
    if (fromBoard) return fromBoard;
  }
  return "B";
}

/**
 * Count the liberties of the marked ("X") group straight from the board so the
 * revealed answer always matches what the learner sees. Returns null when there
 * is no marked group (the caller then trusts the authored answer instead).
 */
function countMarkedGroupLiberties(rows: string[][]): number | null {
  const marked: Array<[number, number]> = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (MARK_TOKENS.has(cell)) {
        marked.push([rowIndex, colIndex]);
      }
    });
  });

  if (marked.length === 0) {
    return null;
  }

  const liberties = new Set<string>();
  for (const [rowIndex, colIndex] of marked) {
    const neighbors: Array<[number, number]> = [
      [rowIndex - 1, colIndex],
      [rowIndex + 1, colIndex],
      [rowIndex, colIndex - 1],
      [rowIndex, colIndex + 1],
    ];
    for (const [neighborRow, neighborCol] of neighbors) {
      const cell = rows[neighborRow]?.[neighborCol];
      if (cell === ".") {
        liberties.add(`${neighborRow}-${neighborCol}`);
      }
    }
  }

  return liberties.size;
}

/** Standard star-point (hoshi) intersections for common board sizes. */
function getStarPoints(size: number): Set<string> {
  const presets: Record<number, Array<[number, number]>> = {
    9: [
      [2, 2],
      [2, 6],
      [6, 2],
      [6, 6],
      [4, 4],
    ],
    13: [
      [3, 3],
      [3, 9],
      [9, 3],
      [9, 9],
      [6, 6],
    ],
    19: [
      [3, 3],
      [3, 9],
      [3, 15],
      [9, 3],
      [9, 9],
      [9, 15],
      [15, 3],
      [15, 9],
      [15, 15],
    ],
  };

  let points = presets[size];
  if (!points) {
    points = size >= 5 && size % 2 === 1 ? [[(size - 1) / 2, (size - 1) / 2]] : [];
  }

  return new Set(points.map(([row, col]) => `${row}-${col}`));
}

export default function GoBoardQuestion({
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  difficulty,
  recommendedDurationMinutes,
  description,
  question,
  board,
  variantLabel,
  explanation,
  componentType,
  expectedAnswer,
  playerColor,
  onComplete,
  onError,
  onCorrectAdvance,
  onWrongAdvance,
  onSkip,
  onHintUse,
  hideChrome = false,
}: GoBoardQuestionProps) {
  const { t } = useI18n();
  const [answer, setAnswer] = useState("");
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    submittedAnswer: string;
    isCorrect: boolean | null;
    correctAnswer: string | null;
  } | null>(null);
  const parsedBoard = useMemo(() => parseBoardData(board), [board]);
  const isNumericAnswerMode =
    componentType === "GoBoardNumeric" ||
    componentType === "GoCountLiberties" ||
    componentType === "GoCountTerritory";
  const isTerritoryMode =
    componentType === "GoCountTerritory" ||
    (componentType === "GoBoardNumeric" && question.includes("目"));
  const isLibertiesMode =
    !isTerritoryMode &&
    (componentType === "GoCountLiberties" ||
      (componentType === "GoBoardNumeric" && parsedBoard.markPoints.length > 0));
  const isCaptureMode =
    componentType === "GoCaptureStones" ||
    (componentType === "GoBoardCoordinate" && (question.includes("提") || question.includes("吃")));
  const isNoEntryMode =
    componentType === "GoNoEntry" ||
    (componentType === "GoBoardCoordinate" && question.includes("禁"));

  // For "choose a point" questions, show which colour stone the learner is
  // placing. Capture/tesuji questions have Black playing onto White; the author
  // can override via the board's player/toPlay/turn field.
  const playColor = useMemo(() => resolvePlayColor(playerColor, board), [playerColor, board]);
  const playStoneStyle = playColor === "W" ? WHITE_STONE_STYLE : BLACK_STONE_STYLE;
  const playColorLabel = playColor === "W" ? "白棋" : "黑棋";

  // Render at the board's natural size so small positions are not distorted by
  // padding (which would otherwise invent phantom liberties at the edges).
  const size = useMemo(() => {
    if (parsedBoard.rows.length === 0) {
      return 9;
    }
    const maxRowLength = parsedBoard.rows.reduce((max, row) => Math.max(max, row.length), 0);
    return Math.max(parsedBoard.rows.length, maxRowLength, 1);
  }, [parsedBoard.rows]);

  const boardRows = useMemo(() => {
    if (parsedBoard.rows.length > 0) {
      return Array.from({ length: size }, (_, rowIndex) => {
        const row = parsedBoard.rows[rowIndex] ?? [];
        return Array.from({ length: size }, (_, colIndex) => row[colIndex] ?? ".");
      });
    }

    return Array.from({ length: size }, () => Array.from({ length: size }, () => "."));
  }, [parsedBoard.rows, size]);

  const starPoints = useMemo(() => getStarPoints(size), [size]);

  // The board is the source of truth for "count liberties" questions.
  const computedAnswer = useMemo(
    () => (isLibertiesMode ? countMarkedGroupLiberties(boardRows) : null),
    [isLibertiesMode, boardRows]
  );

  const hasSubmitted = submissionFeedback !== null;

  const handleSubmit = async () => {
    if (hasSubmitted) {
      return;
    }

    const trimmed = answer.trim();
    if (!trimmed) {
      onError?.("");
      return;
    }

    // Record the attempt with the backend for progress tracking.
    let backendResult: "correct" | "incorrect" | "skipped" | null = null;
    let backendExpected: string | null = null;
    try {
      const response = (await onComplete?.(trimmed)) as SubmissionResponse | undefined;
      backendResult = response?.result ?? null;
      const evaluationExpected = response?.evaluation?.expectedAnswer;
      if (typeof evaluationExpected === "string") {
        backendExpected = evaluationExpected;
      } else if (typeof evaluationExpected === "number") {
        backendExpected = String(evaluationExpected);
      }
    } catch {
      backendResult = null;
    }

    // For "count liberties" the board itself is authoritative, so display and
    // grading come from the position the learner is looking at.
    if (computedAnswer != null) {
      const correctAnswerText = String(computedAnswer);
      const isCorrect = /^\d+$/.test(trimmed) && Number(trimmed) === computedAnswer;
      setSubmissionFeedback({
        submittedAnswer: trimmed,
        isCorrect,
        correctAnswer: correctAnswerText,
      });
      return;
    }

    setSubmissionFeedback({
      submittedAnswer: trimmed,
      isCorrect: backendResult === "correct" ? true : backendResult === "incorrect" ? false : null,
      correctAnswer: backendExpected ?? expectedAnswer ?? null,
    });
  };

  const handleAdvance = () => {
    if (submissionFeedback?.isCorrect === false) {
      onWrongAdvance?.();
    } else {
      onCorrectAdvance?.();
    }
    setAnswer("");
    setSubmissionFeedback(null);
  };

  const handleBoardCellClick = (rowIndex: number, colIndex: number) => {
    if (isNumericAnswerMode || hasSubmitted) {
      return;
    }

    setAnswer(toCoordinate(rowIndex, colIndex, size));
  };

  const handleAnswerChange = (value: string) => {
    if (isNumericAnswerMode) {
      setAnswer(value.replace(/\D/g, ""));
      return;
    }

    setAnswer(value);
  };

  const columnLabels = Array.from({ length: size }, (_, index) => String.fromCharCode(65 + index));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className={`flex-1 overflow-y-auto min-h-0 pr-1 ${!hideChrome ? "lesson-session-scroll" : ""}`}>
        <div className="flex flex-col gap-4 rounded-3xl border border-brand-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:h-full lg:min-h-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal flex items-center gap-1.5">
            <span>{stageLabel ?? `第 ${stageIndex ?? 1} / ${totalStages ?? 1} 關`}</span>
            {topic && (
              <>
                <span className="text-brand-gray-300">•</span>
                <span>{topic}</span>
              </>
            )}
          </div>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h2 className="font-heading text-lg md:text-xl font-black text-brand-gray-700 leading-snug">
              {question}
            </h2>
            <QuestionVoiceReader text={question} />
          </div>
        </div>
        <div className="rounded-full border border-brand-teal/40 bg-brand-teal-bg px-3 py-1 text-sm font-semibold text-brand-teal">
          {variantLabel}
        </div>
      </div>

      {(difficulty || recommendedDurationMinutes) && (
        <div className="flex flex-wrap gap-2 text-xs text-brand-gray-600">
          {difficulty && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
              難度：{difficulty}
            </span>
          )}
          {recommendedDurationMinutes && (
            <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700">
              建議時間：{recommendedDurationMinutes} 分鐘
            </span>
          )}
        </div>
      )}

      {description && (
        <div className="bg-slate-900/5 px-4 py-3 rounded-2xl border border-slate-100 flex items-start gap-2.5">
          <FiInfo className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs font-medium text-slate-500 leading-relaxed">
            {description}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_16rem]">
        {/* ── Go board ─────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-col rounded-2xl border border-brand-gray-200 bg-brand-gray-50 p-3 shadow-inner sm:p-4">
          <div className="mb-3 flex flex-shrink-0 items-center gap-2 text-sm font-semibold text-brand-gray-700">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-teal" />
            棋盤
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* The board must stay a perfect square so intersections (and the
                round stones drawn on them) are never distorted. We use standard CSS
                aspect-ratio, max-height, and max-width constraints to scale it
                responsively within its container. */}
            <div
              className="grid aspect-square w-full h-auto max-w-full max-h-full rounded-lg p-2 sm:p-3 lg:h-full lg:w-auto"
              style={{
                gridTemplateColumns: `1.35rem repeat(${size}, 1fr)`,
                gridTemplateRows: `1.35rem repeat(${size}, 1fr)`,
                background: "linear-gradient(135deg, #e9c07d 0%, #ddb066 100%)",
                boxShadow: "inset 0 2px 10px rgba(120, 80, 30, 0.25)",
              }}
            >
              {/* corner spacer */}
              <div aria-hidden />
              {/* column labels */}
              {columnLabels.map((label) => (
                <div
                  key={`col-${label}`}
                  className="flex items-center justify-center text-[10px] font-semibold text-[#6b4a22]"
                >
                  {label}
                </div>
              ))}

              {boardRows.map((row, rowIndex) => (
                <Fragment key={`row-${rowIndex}`}>
                  <div className="flex items-center justify-center text-[10px] font-semibold text-[#6b4a22]">
                    {size - rowIndex}
                  </div>
                  {row.map((cell, colIndex) => {
                    const coordinate = toCoordinate(rowIndex, colIndex, size);
                    // "X" marks the group to count for 數氣; in every other
                    // variant it is the (empty) answer point, so it must render
                    // as a plain intersection and never be highlighted.
                    const isMarkedStone = MARK_TOKENS.has(cell) && isLibertiesMode;
                    const isBlack = cell === "B" || cell === "b";
                    const isWhite = cell === "W" || cell === "w";
                    const isCoordMarked =
                      isLibertiesMode && parsedBoard.markPoints.includes(coordinate);
                    const isStone = isBlack || isWhite || isMarkedStone;
                    const isTargeted = isMarkedStone || isCoordMarked;
                    const isStar = starPoints.has(`${rowIndex}-${colIndex}`);
                    const isSelected = !isNumericAnswerMode && answer === coordinate;

                    const stoneStyle = isWhite ? WHITE_STONE_STYLE : BLACK_STONE_STYLE;

                    return (
                      <button
                        key={coordinate}
                        type="button"
                        disabled={isNumericAnswerMode || hasSubmitted}
                        onClick={() => handleBoardCellClick(rowIndex, colIndex)}
                        aria-label={`交叉點 ${coordinate}`}
                        className="group relative h-full w-full disabled:cursor-default"
                      >
                        {/* grid lines */}
                        {colIndex > 0 && (
                          <span className="absolute left-0 top-1/2 h-[1.5px] w-1/2 -translate-y-1/2 bg-[#7a5a30]" />
                        )}
                        {colIndex < size - 1 && (
                          <span className="absolute right-0 top-1/2 h-[1.5px] w-1/2 -translate-y-1/2 bg-[#7a5a30]" />
                        )}
                        {rowIndex > 0 && (
                          <span className="absolute left-1/2 top-0 h-1/2 w-[1.5px] -translate-x-1/2 bg-[#7a5a30]" />
                        )}
                        {rowIndex < size - 1 && (
                          <span className="absolute bottom-0 left-1/2 h-1/2 w-[1.5px] -translate-x-1/2 bg-[#7a5a30]" />
                        )}

                        {/* star point */}
                        {isStar && !isStone && (
                          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5a4020]" />
                        )}

                        {/* hover preview of the stone you would place */}
                        {!isStone && !isNumericAnswerMode && !hasSubmitted && !isSelected && (
                          <span
                            className={`pointer-events-none absolute inset-[14%] rounded-full opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-opacity duration-150 group-hover:opacity-40 ${playStoneStyle}`}
                          />
                        )}

                        {/* stone */}
                        {isStone && (
                          <span
                            className={`absolute inset-[12%] rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${stoneStyle}`}
                          >
                            {isMarkedStone && (
                              <span className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] bg-amber-400" />
                            )}
                          </span>
                        )}

                        {/* target highlight ring */}
                        {isTargeted && (
                          <span className="pointer-events-none absolute inset-[4%] rounded-full ring-2 ring-amber-400" />
                        )}

                        {/* selected point: show the stone you would play (its
                            colour) and keep the blue selection ring */}
                        {isSelected && !isStone && (
                          <span
                            className={`pointer-events-none absolute inset-[12%] rounded-full opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${playStoneStyle}`}
                          />
                        )}
                        {isSelected && (
                          <span className="pointer-events-none absolute inset-[4%] rounded-full ring-2 ring-brand-teal" />
                        )}
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* ── Answer panel ─────────────────────────────────────────── */}
        <div className="space-y-3 rounded-2xl border border-brand-gray-200 bg-brand-gray-50 p-4 lg:min-h-0 lg:overflow-y-auto">
          <div className="text-sm font-semibold text-brand-gray-700">你的答案</div>
          {!isNumericAnswerMode && (
            <div className="flex items-center gap-1.5 text-xs text-brand-gray-600">
              {isNoEntryMode ? "要找的是禁入點，針對" : "你要落下的是"}
              <span
                className={`inline-block h-4 w-4 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.35)] ${playStoneStyle}`}
              />
              <span className="font-semibold text-brand-gray-700">{playColorLabel}</span>
            </div>
          )}
          <input
            value={answer}
            onChange={(event) => handleAnswerChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (hasSubmitted) {
                  handleAdvance();
                } else {
                  void handleSubmit();
                }
              }
            }}
            disabled={hasSubmitted}
            inputMode={isNumericAnswerMode ? "numeric" : "text"}
            placeholder={isNumericAnswerMode ? "例如：4" : "例如：D4"}
            className="w-full rounded-xl border border-brand-gray-300 bg-white px-3 py-2.5 text-base font-semibold text-brand-gray-700 outline-none transition-colors focus:border-brand-teal disabled:bg-brand-gray-100 disabled:text-brand-gray-400"
          />



          {submissionFeedback && (
            <div
              className={`rounded-xl border p-3 text-sm ${
                submissionFeedback.isCorrect === true
                  ? "border-brand-green/40 bg-brand-green/10 text-green-700"
                  : submissionFeedback.isCorrect === false
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-brand-gray-200 bg-white text-brand-gray-700"
              }`}
            >
              <div className="mb-1 flex items-center gap-2 font-semibold">
                {submissionFeedback.isCorrect === true ? (
                  <>
                    <FiCheckCircle /> 答對了！
                  </>
                ) : submissionFeedback.isCorrect === false ? (
                  <>
                    <FiXCircle /> 答錯了
                  </>
                ) : (
                  <>
                    <FiBookOpen /> 已提交
                  </>
                )}
              </div>
              <p>你的答案：{submissionFeedback.submittedAnswer}</p>
              {submissionFeedback.correctAnswer && submissionFeedback.isCorrect !== true && (
                <p className="mt-1 font-semibold">正確答案：{submissionFeedback.correctAnswer}</p>
              )}
            </div>
          )}

          {explanation && hasSubmitted && (
            <div className="rounded-xl border border-brand-teal/30 bg-brand-teal-bg p-3 text-sm text-brand-gray-700">
              <div className="mb-1 flex items-center gap-2 font-semibold text-brand-teal">
                <FiBookOpen /> 解題提示
              </div>
              <p className="leading-relaxed">{explanation}</p>
            </div>
          )}
        </div>
      </div>
      </div>
      </div>
      {!hideChrome && (
        <QuestionActionBar
          onSkip={onSkip}
          onContinue={hasSubmitted ? handleAdvance : handleSubmit}
          isContinueDisabled={(!answer.trim() && !hasSubmitted)}
          continueLabel={
            hasSubmitted
              ? t("lesson.action.continue")
              : t("lesson.action.check")
          }
        />
      )}
    </div>
  );
}
