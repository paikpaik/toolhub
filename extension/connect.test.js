import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./connect.js";

const { connectProductId, isDetailFrame, parseConnectPage, connectRequestProblem, formatConnectRequest } = globalThis.ToolhubConnect;

// 2026-11-15 브랜드커넥트 상품 페이지 화면을 보고 만든 글자 줄 (실제 innerText 줄바꿈과 다를 수 있음)
const PAGE = [
  "BRAND CONNECT",
  "상품 정보",
  "수수료+",
  "피토메스",
  "피토메스 안티포어 리파이닝 스킨로션 2종, 300ml, 1개",
  "★ 4.79",
  "리뷰 20,474",
  "판매가",
  "57,000원",
  "할인가",
  "31%",
  "39,000원",
  "수수료",
  "23%",
  "추가 수수료 3% 지급",
  "링크 복사",
  "링크 발급 시 주의사항",
  '"이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다."',
  "상세 정보",
  "네이버 쇼핑에서 보기",
  "피토메스 안티포어 리파이닝 스킨로션 2종 FAQ",
  "Q1.",
  "  30대 남자 입니다.  ",
  "",
  "상세정보",
  "용량\t150ml",
];

describe("쇼핑 커넥트 상품 페이지", () => {
  it("상품 주소에서 상품 번호, 다른 주소는 null", () => {
    assert.equal(connectProductId("https://brandconnect.naver.com/1017611090931296/affiliate/products/933686166733248"), "933686166733248");
    assert.equal(connectProductId("https://brandconnect.naver.com/1017611090931296/affiliate/products/933686166733248?tab=1"), "933686166733248");
    assert.equal(connectProductId("https://brandconnect.naver.com/1017611090931296/affiliate"), null);
    assert.equal(connectProductId("https://blog.naver.com/x"), null);
    assert.equal(connectProductId("잘못된 주소"), null);
  });

  it("라벨로 브랜드·상품명·평점·가격, 상세 정보 글자를 읽는다 (수수료는 값으로만)", () => {
    const product = parseConnectPage(PAGE, { shoppingUrl: "https://smartstore.naver.com/x/products/1" });
    assert.deepEqual(product, {
      brand: "피토메스",
      name: "피토메스 안티포어 리파이닝 스킨로션 2종, 300ml, 1개",
      rating: "4.79",
      reviews: "20,474",
      price: "57,000원",
      salePrice: "31% 39,000원",
      detail: "피토메스 안티포어 리파이닝 스킨로션 2종 FAQ\nQ1.\n30대 남자 입니다.\n상세정보\n용량 150ml",
      shoppingUrl: "https://smartstore.naver.com/x/products/1",
    });
  });

  it("라벨과 값이 한 줄에 있어도, 평점·리뷰가 한 줄이어도 읽는다", () => {
    const product = parseConnectPage(["상품 정보", "브랜드A", "상품 이름이 긴 상품", "★4.5 | 리뷰 1,234", "판매가 10,000원", "할인가 10% 9,000원", "링크 복사"]);
    assert.equal(product.rating, "4.5");
    assert.equal(product.reviews, "1,234");
    assert.equal(product.price, "10,000원");
    assert.equal(product.salePrice, "10% 9,000원");
    assert.equal(product.brand, "브랜드A");
    assert.equal(product.detail, null);
  });

  it("상세 iframe의 글자가 있으면 그것을 상세 정보로 (본문의 사이트 아래쪽 메뉴는 버림)", () => {
    const page = ["상품 정보", "상품 이름", "판매가", "1,000원", "링크 복사", "상세 정보", "네이버 쇼핑에서 보기", "TOP", "로그아웃", "이용약관"];
    assert.equal(parseConnectPage(page, { detailLines: ["  FAQ ", "", "용량\t150ml"] }).detail, "FAQ\n용량 150ml");
    assert.equal(parseConnectPage(page, { detailLines: [] }).detail, null);
    assert.ok(isDetailFrame("https://m.smartstore.naver.com/phyto/products/389854589/shopping-connect-contents"));
    assert.ok(!isDetailFrame("https://smartstore.naver.com/phyto/products/389854589"));
    assert.ok(!isDetailFrame("https://brandconnect.naver.com/1/affiliate/products/2"));
  });

  it("상품 정보 영역이 없으면 null, 상세 정보가 길면 자른다", () => {
    assert.equal(parseConnectPage(["다른 페이지"]), null);
    const long = parseConnectPage(["상품 정보", "상품", "링크 복사", "상세 정보", "가".repeat(5000)]);
    assert.match(long.detail, /…\(이하 생략\)$/);
    assert.equal(long.detail.length, 4000 + "\n…(이하 생략)".length);
  });
});

describe("쇼핑 커넥트 요청문", () => {
  const product = parseConnectPage(PAGE);

  it("링크가 없거나 주소가 아니면, 실제 경험인데 메모가 없으면 막는다", () => {
    assert.match(connectRequestProblem({ link: " ", mode: "guide" }), /링크를 붙여넣어/);
    assert.match(connectRequestProblem({ link: "naver.me/abc", mode: "guide" }), /https:\/\//);
    assert.match(connectRequestProblem({ link: "https://naver.me/abc", mode: "experience", memo: " " }), /경험 메모/);
    assert.equal(connectRequestProblem({ link: "https://naver.me/abc", mode: "guide" }), null);
    assert.match(connectRequestProblem({ link: "https://naver.me/abc", mode: "guide", account: " ", hasAccounts: true }), /계정을 골라/);
    assert.equal(connectRequestProblem({ link: "https://naver.me/abc", mode: "guide", account: "우드", hasAccounts: true }), null);
  });

  it("구매 가이드: 링크·글 방식·상품 정보, 수수료와 경험 메모는 넣지 않는다", () => {
    const text = formatConnectRequest({ product, link: " https://naver.me/abc ", mode: "guide", memo: "안 쓰는 메모" });
    assert.match(text, /^\[쇼핑 커넥트 요청\]\n/);
    assert.match(text, /키워드: 상품명에서 검색될 말로 정해 주세요/);
    assert.match(text, /쇼핑 커넥트 링크: https:\/\/naver\.me\/abc\n/);
    assert.match(text, /글 방식: 구매 가이드 \(guide\)/);
    assert.match(text, /평점: 4\.79 \(리뷰 20,474\)/);
    assert.match(text, /할인가: 31% 39,000원/);
    assert.match(text, /상세 정보 \(판매자 설명\):\n피토메스 안티포어/);
    assert.doesNotMatch(text, /수수료: |23%|경험 메모:|안 쓰는 메모|계정:|account/);
  });

  it("계정을 고르면 계정 줄과 save_draft account 안내를 넣는다", () => {
    const text = formatConnectRequest({ product, link: "https://naver.me/abc", mode: "guide", account: " 우드 " });
    assert.match(text, /save_draft의 account에는 아래 계정을 넣어 주세요\.\n계정: 우드\n키워드: /);
  });

  it("실제 경험: 경험 메모와 정한 키워드를 넣는다", () => {
    const text = formatConnectRequest({ product, link: "https://naver.me/abc", mode: "experience", memo: " 2주 사용\n향이 순함 ", keyword: "피토메스 스킨로션 후기" });
    assert.match(text, /키워드: 피토메스 스킨로션 후기/);
    assert.match(text, /글 방식: 실제 경험 \(experience\)\n경험 메모:\n2주 사용\n향이 순함\n상품 정보:/);
  });
});
