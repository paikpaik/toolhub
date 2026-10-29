# 플랫폼 규칙: 티스토리

글쓰기 화면에서 **기본모드 → HTML 모드로 바꾼 뒤** 본문을 붙여넣는 것을 전제로 합니다.
티스토리 글은 다음(Daum)과 구글 검색에 노출되고, 애드센스 광고가 본문 사이에 자동으로 들어갑니다.

## 분량
- 본문 2,000~3,000자 (공백 포함)

## 제목
- 30~40자. 메인 키워드를 앞쪽에 둡니다.

## 메타 설명
- 티스토리는 글마다 따로 입력하는 칸이 없으므로, 본문 첫 문단이 검색 결과 설명으로 쓰입니다. **도입 문단을 120자 안팎의 요약이 되도록** 씁니다.
- 출력의 "메타 설명" 항목에는 도입 문단을 그대로 적습니다.

## 태그
- 5~10개. 메인 키워드와 연관 키워드 위주.

## 본문 HTML 형식
- 코드 블록 언어는 `html`.
- 사용 태그: `<h2>`(소제목), `<h3>`(작은 소제목), `<p>`, `<ul>`/`<ol>`/`<li>`, `<table>`, `<strong>`, `<blockquote>`, `<a>`.
- `<h1>`은 쓰지 않습니다. 제목은 티스토리가 따로 표시합니다.
- 스킨 디자인과 충돌하지 않도록 `style` 속성은 표에만 최소한으로 씁니다.
  ```html
  <table style="width:100%; border-collapse:collapse;">
    <tr><th style="border:1px solid #ddd; padding:8px;">구분</th><th style="border:1px solid #ddd; padding:8px;">내용</th></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;">…</td><td style="border:1px solid #ddd; padding:8px;">…</td></tr>
  </table>
  ```
- 문단은 3~4문장 이내로 끊습니다. 광고가 문단 사이에 들어가므로 너무 긴 문단은 피합니다.
- 사람이 채울 자리는 눈에 띄게 별도 문단으로 넣습니다.
  ```html
  <p>[이미지: … | alt: … | 추천: …]</p>
  <p>[직접 작성: …]</p>
  ```
- 외부 링크(공식 사이트 등)는 `<a href="…" target="_blank" rel="noopener">`로 넣습니다.
