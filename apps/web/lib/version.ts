import rootPackage from "../../../package.json";

/** toolhub 버전. 저장소 루트 package.json 하나만 고치면 되고, 다른 패키지·확장과 같은지는 version.test.ts가 확인한다 */
export const VERSION = rootPackage.version;

/** 실행 중인 커밋 (open_web으로 띄운 웹에만 있다. npm run web으로 띄우면 null) */
export const COMMIT = process.env.TOOLHUB_COMMIT?.slice(0, 7) ?? null;
