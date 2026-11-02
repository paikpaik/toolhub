/** 덩어리 기록 화면 (서버 페이지와 클라이언트가 함께 쓰므로 "use client" 파일 밖에 둔다) */
export const CHUNK_VIEWS = ["today", "week", "help"] as const;
export type ChunkView = (typeof CHUNK_VIEWS)[number];
export const VIEW_LABELS: Record<ChunkView, string> = { today: "오늘", week: "주간 보드", help: "쓰는 법" };
