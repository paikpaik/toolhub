import path from "node:path";

/** 저장소 루트의 data/ (next dev는 apps/web에서 실행된다) */
export const DATA_DIR = process.env.TOOLHUB_DATA_DIR ?? path.resolve(process.cwd(), "../../data");
