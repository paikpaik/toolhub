import { Black_Han_Sans, Jua, Noto_Sans_KR } from "next/font/google";

// 한글 글꼴은 파일이 커서 미리 불러오지 않고, 캔버스에 그리기 직전에 필요한 글자만 불러온다 (document.fonts.load)
const notoSansKr = Noto_Sans_KR({ weight: ["500", "900"], subsets: ["latin"], preload: false });
const blackHanSans = Black_Han_Sans({ weight: "400", subsets: ["latin"], preload: false });
const jua = Jua({ weight: "400", subsets: ["latin"], preload: false });

export interface ThumbnailFont {
  id: string;
  name: string;
  className: string;
  /** 캔버스 ctx.font에 쓰는 font-family 목록 */
  family: string;
  /** 제목에 쓰는 굵기 */
  titleWeight: number;
  /** 부제·라벨·블로그 이름에 쓰는 굵기 */
  bodyWeight: number;
}

export const THUMBNAIL_FONTS: ThumbnailFont[] = [
  {
    id: "noto",
    name: "깔끔 (Noto Sans KR)",
    className: notoSansKr.className,
    family: notoSansKr.style.fontFamily,
    titleWeight: 900,
    bodyWeight: 500,
  },
  {
    id: "blackhan",
    name: "임팩트 (Black Han Sans)",
    className: blackHanSans.className,
    family: blackHanSans.style.fontFamily,
    titleWeight: 400,
    bodyWeight: 400,
  },
  { id: "jua", name: "부드러움 (Jua)", className: jua.className, family: jua.style.fontFamily, titleWeight: 400, bodyWeight: 400 },
];
