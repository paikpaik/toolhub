import { CaptionChecker } from "./caption-checker";

export default function CaptionPage() {
  return (
    <main>
      <header>
        <h1>
          캡션 점검 <small>첫 줄 · 해시태그 5개 · 링크 · 요청 하나 · 쿠팡 대가성 문구 · 검색어</small>
        </h1>
      </header>
      <CaptionChecker />
    </main>
  );
}
