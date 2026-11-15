/**
 * 패널의 쇼핑 커넥트 영역: 브랜드커넥트 상품 페이지를 보고 있으면 상품 정보를 읽고,
 * 링크·글 방식·경험 메모를 받아 Claude 앱에 붙여넣을 요청문을 복사한다.
 * sidepanel.js와 같은 전역에서 돌므로 이름이 겹치지 않게 감싼다
 */
(() => {
  const { connectProductId, parseConnectPage, connectRequestProblem, formatConnectRequest } = ToolhubConnect;
  const $ = (id) => document.getElementById(id);
  const section = $("connect");
  const productLine = $("connect-product");
  const linkInput = $("connect-link");
  const memoField = $("connect-memo-field");
  const memoInput = $("connect-memo");
  const keywordInput = $("connect-keyword");
  const preview = $("connect-preview");
  const statusLine = $("connect-status");

  /** 상품마다 입력을 기억한다 (탭을 오가거나 패널을 다시 열어도 남게). 오래된 것부터 지운다 */
  const INPUTS_KEY = "connectInputs";
  const MAX_SAVED = 30;
  /** 페이지가 늦게 그려질 수 있어 상품 정보를 못 찾으면 몇 번 더 읽는다 */
  const READ_TRIES = 5;

  let productId = null;
  let tabId = null;
  let product = null;

  function setStatus(text, isError = false) {
    statusLine.textContent = text;
    statusLine.classList.toggle("error", isError);
  }

  const mode = () => document.querySelector('input[name="connect-mode"]:checked').value;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function saveInputs() {
    if (!productId) return;
    const { [INPUTS_KEY]: saved = {} } = await chrome.storage.local.get(INPUTS_KEY);
    saved[productId] = { link: linkInput.value, mode: mode(), memo: memoInput.value, keyword: keywordInput.value, at: Date.now() };
    const kept = Object.entries(saved)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, MAX_SAVED);
    await chrome.storage.local.set({ [INPUTS_KEY]: Object.fromEntries(kept) });
  }

  async function restoreInputs() {
    const { [INPUTS_KEY]: saved = {} } = await chrome.storage.local.get(INPUTS_KEY);
    const inputs = saved[productId] ?? {};
    linkInput.value = inputs.link ?? "";
    memoInput.value = inputs.memo ?? "";
    keywordInput.value = inputs.keyword ?? "";
    document.querySelector(`input[name="connect-mode"][value="${inputs.mode === "experience" ? "experience" : "guide"}"]`).checked = true;
    memoField.hidden = mode() !== "experience";
  }

  /** 페이지 글자를 줄로 읽는다 ("네이버 쇼핑에서 보기" 링크 주소도 함께) */
  async function readPage() {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        lines: document.body.innerText.split("\n"),
        shoppingUrl: [...document.querySelectorAll("a")].find((a) => a.textContent.includes("네이버 쇼핑에서 보기"))?.href ?? null,
      }),
    });
    return parseConnectPage(result.lines, { shoppingUrl: result.shoppingUrl });
  }

  function showProduct() {
    if (!product) {
      productLine.textContent = "상품 정보를 찾지 못했어요. 페이지가 다 뜬 뒤 \"다시 읽기\"를 눌러 주세요.";
      productLine.classList.add("error");
      preview.textContent = "";
      return;
    }
    productLine.classList.remove("error");
    productLine.textContent = [product.name, product.salePrice ?? product.price].filter(Boolean).join(" · ");
    preview.textContent = formatConnectRequest({ product, link: linkInput.value || "(링크)", mode: "guide" }).split("상품 정보:\n")[1] ?? "";
  }

  async function read() {
    const id = productId;
    productLine.textContent = "상품 정보를 읽는 중…";
    productLine.classList.remove("error");
    product = null;
    for (let i = 0; i < READ_TRIES && !product; i++) {
      if (i) await sleep(1000);
      if (id !== productId) return; // 그새 다른 상품으로 옮겼다
      try {
        product = await readPage();
      } catch {
        product = null; // 페이지를 읽을 수 없는 순간(이동 중 등). 다시 시도
      }
    }
    if (id === productId) showProduct();
  }

  /** 지금 탭이 브랜드커넥트 상품 페이지면 영역을 보이고, 새 상품이면 입력을 불러와 읽는다 */
  async function refresh() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const id = connectProductId(tab?.url ?? "");
    section.hidden = !id;
    if (!id) return;
    tabId = tab.id;
    if (id === productId && product) return;
    const changed = id !== productId;
    productId = id;
    if (changed) {
      setStatus("");
      await restoreInputs();
    }
    await read();
  }

  chrome.tabs.onActivated.addListener(refresh);
  // 브랜드커넥트는 페이지를 새로 열지 않고 주소만 바꿔 상품을 옮기므로 주소가 바뀔 때도 다시 본다
  chrome.tabs.onUpdated.addListener((_id, change, tab) => tab.active && (change.url || change.status === "complete") && refresh());

  $("connect-read").addEventListener("click", read);
  for (const input of [linkInput, memoInput, keywordInput]) input.addEventListener("input", saveInputs);
  for (const radio of document.querySelectorAll('input[name="connect-mode"]')) {
    radio.addEventListener("change", () => {
      memoField.hidden = mode() !== "experience";
      saveInputs();
    });
  }

  $("connect-copy").addEventListener("click", async () => {
    if (!product) return setStatus("상품 정보를 아직 읽지 못했어요. \"다시 읽기\"를 눌러 주세요.", true);
    const input = { product, link: linkInput.value, mode: mode(), memo: memoInput.value, keyword: keywordInput.value };
    const problem = connectRequestProblem(input);
    if (problem) return setStatus(problem, true);
    try {
      await navigator.clipboard.writeText(formatConnectRequest(input));
      setStatus("복사했어요. Claude 앱에 붙여넣으면 초안을 써서 저장해요.");
    } catch (e) {
      setStatus(`복사하지 못했어요: ${e.message}`, true);
    }
  });

  refresh();
})();
