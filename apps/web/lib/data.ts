import path from "node:path";

/** 저장소 루트의 data/ (next dev는 apps/web에서 실행된다) */
export const DATA_DIR = process.env.TOOLHUB_DATA_DIR ?? path.resolve(process.cwd(), "../../data");

/** 저장소 루트의 drafts/ (MCP save_draft, /blog-draft가 초안을 저장하는 곳) */
export const DRAFTS_DIR = process.env.TOOLHUB_DRAFTS_DIR ?? path.resolve(process.cwd(), "../../drafts");
