/**
 * 패널의 쇼핑 커넥트 영역: 브랜드커넥트 상품 페이지를 보고 있으면 상품 정보를 읽고,
 * 링크·글 방식·경험 메모를 받아 Claude 앱에 붙여넣을 요청문을 복사한다.
 * sidepanel.js와 같은 전역에서 돌므로 이름이 겹치지 않게 감싼다
 */
(() => {
  const { connectProductId, isDetailFrame, parseConnectPage, connectRequestProblem, formatConnectRequest } = ToolhubConnect;
  const { fetchWebAccounts } = ToolhubLib;
  const $ = (id) => document.getElementById(id);
  const body = $("connect-body");
  const none = $("connect-none");
  const productLine = $("connect-product");
  const linkInput = $("connect-link");
  const memoField = $("connect-memo-field");
  const memoInput = $("connect-memo");
  const keywordInput = $("connect-keyword");
  const accountRow = $("connect-account-row");
  const accountSelect = $("connect-account");
  const preview = $("connect-preview");
  const statusLine = $("connect-status");

  /** 상품마다 입력을 기억한다 (탭을 오가거나 패널을 다시 열어도 남게). 오래된 것부터 지운다 */
  const INPUTS_KEY = "connectInputs";
  const MAX_SAVED = 30;
  /** 마지막으로 고른 계정 (새 상품을 열면 이 계정으로 시작) */
  const LAST_ACCOUNT_KEY = "connectAccount";
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
    saved[productId] = { link: linkInput.value, mode: mode(), memo: memoInput.value, keyword: keywordInput.value, account: accountSelect.value, at: Date.now() };
    const kept = Object.entries(saved)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, MAX_SAVED);
    await chrome.storage.local.set({ [INPUTS_KEY]: Object.fromEntries(kept), ...(accountSelect.value && { [LAST_ACCOUNT_KEY]: accountSelect.value }) });
  }

  async function restoreInputs() {
    const { [INPUTS_KEY]: saved = {} } = await chrome.storage.local.get(INPUTS_KEY);
    const inputs = saved[productId] ?? {};
    linkInput.value = inputs.link ?? "";
    memoInput.value = inputs.memo ?? "";
    keywordInput.value = inputs.keyword ?? "";
    document.querySelector(`input[name="connect-mode"][value="${inputs.mode === "experience" ? "experience" : "guide"}"]`).checked = true;
    memoField.hidden = mode() !== "experience";
    await loadAccounts(inputs.account);
  }

  /**
   * 웹에 등록된 계정으로 계정 고르기를 채운다. 이 상품에서 고른 계정 → 마지막으로 고른 계정 순.
   * 계정이 없거나 웹이 꺼져 있으면 숨긴다 (요청문에 계정 없이, Claude 앱이 계정을 묻는다)
   */
  async function loadAccounts(chosen) {
    const accounts = (await fetchWebAccounts()) ?? [];
    accountRow.hidden = !accounts.length;
    if (!accounts.length) return accountSelect.replaceChildren();
    const { [LAST_ACCOUNT_KEY]: last } = await chrome.storage.local.get(LAST_ACCOUNT_KEY);
    accountSelect.replaceChildren(new Option("계정 고르기", ""), ...accounts.map((a) => new Option(a.name, a.id)));
    accountSelect.value = [chosen, last].find((id) => id && accounts.some((a) => a.id === id)) ?? "";
  }

  /** 모든 프레임에서 func를 돌려 [{ frameId, result }]. 본문(frameId 0)이 먼저 오게 */
  async function inFrames(func) {
    const results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func });
    return results.filter((r) => r.result).sort((a, b) => (a.frameId === 0 ? -1 : b.frameId === 0 ? 1 : 0));
  }

  /** 본문 글자 줄("네이버 쇼핑에서 보기" 링크 주소도 함께)과, 상세 정보 iframe의 글자 줄 */
  async function readPage() {
    const frames = await inFrames(() => ({
      url: location.href,
      lines: document.body?.innerText.split("\n") ?? [],
      shoppingUrl: [...document.querySelectorAll("a")].find((a) => a.textContent.includes("네이버 쇼핑에서 보기"))?.href ?? null,
    }));
    const main = frames.find((f) => f.frameId === 0)?.result;
    if (!main) return null;
    const detail = frames.find((f) => isDetailFrame(f.result.url))?.result;
    return parseConnectPage(main.lines, { shoppingUrl: main.shoppingUrl, detailLines: detail?.lines });
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

  /** 지금 탭이 브랜드커넥트 상품 페이지면 입력 영역을 보이고(아니면 안내), 새 상품이면 입력을 불러와 읽는다 */
  async function refresh() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const id = connectProductId(tab?.url ?? "");
    body.hidden = !id;
    none.hidden = !!id;
    if (!id) return;
    tabId = tab.id;
    if (id === productId && product) return;
    const changed = id !== productId;
    productId = id;
    if (changed) {
      setStatus("");
      closePicker();
      await restoreInputs();
    }
    await read();
  }

  chrome.tabs.onActivated.addListener(refresh);
  // 브랜드커넥트는 페이지를 새로 열지 않고 주소만 바꿔 상품을 옮기므로 주소가 바뀔 때도 다시 본다
  chrome.tabs.onUpdated.addListener((_id, change, tab) => tab.active && (change.url || change.status === "complete") && refresh());

  $("connect-read").addEventListener("click", read);
  for (const input of [linkInput, memoInput, keywordInput]) input.addEventListener("input", saveInputs);
  accountSelect.addEventListener("change", saveInputs);
  for (const radio of document.querySelectorAll('input[name="connect-mode"]')) {
    radio.addEventListener("change", () => {
      memoField.hidden = mode() !== "experience";
      saveInputs();
    });
  }

  $("connect-copy").addEventListener("click", async () => {
    if (!product) return setStatus("상품 정보를 아직 읽지 못했어요. \"다시 읽기\"를 눌러 주세요.", true);
    const account = accountRow.hidden ? "" : (accountSelect.selectedOptions[0]?.value ? accountSelect.selectedOptions[0].text : "");
    const input = { product, link: linkInput.value, mode: mode(), memo: memoInput.value, keyword: keywordInput.value, account, hasAccounts: !accountRow.hidden };
    const problem = connectRequestProblem(input);
    if (problem) return setStatus(problem, true);
    try {
      await navigator.clipboard.writeText(formatConnectRequest(input));
      setStatus("복사했어요. Claude 앱에 붙여넣으면 초안을 써서 저장해요.");
    } catch (e) {
      setStatus(`복사하지 못했어요: ${e.message}`, true);
    }
  });

  // ── 상세 이미지 고르기: 페이지의 큰 이미지를 모아, 세로로 긴 것은 여백에서 잘라 고르게 한다 ──
  const { blankRows, findCuts, trimPiece, pickPageImages, MAX } = ToolhubSlicer;
  const picker = $("connect-picker");
  const piecesEl = $("connect-pieces");
  const pickedLine = $("connect-picked");
  const imagesButton = $("connect-images");
  /** 픽셀을 이만큼씩 나눠 읽는다 (아주 긴 이미지를 한 캔버스에 그리면 크기 제한에 걸림) */
  const STRIP = 1024;
  let pieces = [];

  /**
   * 페이지를 끝까지 한 번 훑어 지연 로딩 이미지를 띄운 뒤 원래 위치로 돌아오고, 이미지 목록을 돌려준다.
   * 상세 이미지는 상세 정보 iframe 안에 있어 모든 프레임에서 훑고 모은다 (본문 갤러리 → 상세 순).
   * iframe이 자기 스크롤을 가질 수도 있어 프레임마다 자기 문서를 내린다
   */
  async function collectImages() {
    const frames = await inFrames(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const start = scrollY;
      for (let y = 0, i = 0; y < document.documentElement.scrollHeight && i < 60; y += innerHeight, i++) {
        scrollTo(0, y);
        await wait(250);
      }
      scrollTo(0, start);
      return [...document.images].map((img) => ({
        src: img.currentSrc || img.src,
        lazy: img.dataset.src || img.dataset.original || img.dataset.lazySrc || null,
        width: img.naturalWidth,
        height: img.naturalHeight,
        shownWidth: img.getBoundingClientRect().width,
      }));
    });
    return pickPageImages(frames.flatMap((f) => f.result));
  }

  /** 원본 형식이 JPEG면 JPEG로, 아니면 PNG로 (블로그 에디터가 받는 형식) */
  const encode = (canvas, type) => canvas.convertToBlob(type === "image/jpeg" ? { type, quality: 0.92 } : { type: "image/png" });

  /** 이미지 하나 → 조각 Blob 목록. 세로가 가로의 2배 이하면 원본 그대로 */
  async function slice(url) {
    const blob = await fetchImage(url);
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    try {
      if (height <= width * MAX) return [blob];
      const blank = new Uint8Array(height);
      const strip = new OffscreenCanvas(width, STRIP);
      const context = strip.getContext("2d", { willReadFrequently: true });
      for (let y = 0; y < height; y += STRIP) {
        const rows = Math.min(STRIP, height - y);
        context.clearRect(0, 0, width, STRIP);
        context.drawImage(bitmap, 0, y, width, rows, 0, 0, width, rows);
        blank.set(blankRows(context.getImageData(0, 0, width, rows).data, width, rows), y);
      }
      const out = [];
      for (const [top, bottom] of findCuts(blank, width)) {
        const piece = trimPiece(blank, top, bottom);
        if (!piece) continue;
        const canvas = new OffscreenCanvas(width, piece[1] - piece[0]);
        canvas.getContext("2d").drawImage(bitmap, 0, piece[0], width, canvas.height, 0, 0, width, canvas.height);
        out.push(await encode(canvas, blob.type));
      }
      return out;
    } finally {
      bitmap.close();
    }
  }

  function updatePicked() {
    const count = pieces.filter((p) => p.checked).length;
    pickedLine.textContent = `${pieces.length}장 중 ${count}장 고름`;
    $("connect-add").disabled = count === 0;
    $("connect-all").textContent = count === pieces.length ? "모두 해제" : "모두 선택";
  }

  function closePicker() {
    for (const piece of pieces) URL.revokeObjectURL(piece.preview);
    pieces = [];
    piecesEl.replaceChildren();
    picker.hidden = true;
  }

  function renderPieces() {
    piecesEl.replaceChildren(
      ...pieces.map((piece) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "piece";
        button.title = piece.label;
        button.innerHTML = `<img alt="" /><span></span>`;
        button.querySelector("img").src = piece.preview;
        button.querySelector("span").textContent = piece.label;
        button.addEventListener("click", () => {
          piece.checked = !piece.checked;
          button.classList.toggle("checked", piece.checked);
          updatePicked();
        });
        return button;
      }),
    );
    picker.hidden = false;
    updatePicked();
  }

  imagesButton.addEventListener("click", async () => {
    if (!tabId) return;
    closePicker();
    imagesButton.disabled = true;
    try {
      setStatus("페이지를 끝까지 훑어 이미지를 모으는 중… (페이지가 잠깐 스크롤돼요)");
      const urls = await collectImages();
      if (!urls.length) return setStatus("담을 만한 큰 이미지를 찾지 못했어요. 상세 정보를 끝까지 내린 뒤 다시 눌러 주세요.", true);
      const failed = [];
      for (const [i, url] of urls.entries()) {
        setStatus(`이미지 ${i + 1}/${urls.length} 자르는 중…`);
        try {
          const blobs = await slice(url);
          blobs.forEach((blob, n) =>
            pieces.push({ blob, url, checked: false, preview: URL.createObjectURL(blob), label: blobs.length > 1 ? `${i + 1}-${n + 1}` : `${i + 1}` }),
          );
        } catch {
          failed.push(i + 1);
        }
      }
      renderPieces();
      setStatus(`${urls.length}장에서 조각 ${pieces.length}장을 만들었어요. 넣을 것만 눌러 고르세요.${failed.length ? ` (${failed.join(", ")}번은 받지 못했어요)` : ""}`);
    } catch (e) {
      setStatus(`이미지를 모으지 못했어요: ${e.message}`, true);
    } finally {
      imagesButton.disabled = false;
    }
  });

  $("connect-all").addEventListener("click", () => {
    const all = !pieces.every((p) => p.checked);
    pieces.forEach((p) => (p.checked = all));
    piecesEl.querySelectorAll(".piece").forEach((el) => el.classList.toggle("checked", all));
    updatePicked();
  });
  $("connect-close").addEventListener("click", closePicker);

  $("connect-add").addEventListener("click", async () => {
    const chosen = pieces.filter((p) => p.checked);
    $("connect-add").disabled = true;
    try {
      // 이미지 모음은 새로 담은 게 맨 앞이라, 페이지 순서대로 보이게 뒤에서부터 담는다
      for (const [i, piece] of [...chosen].reverse().entries()) {
        setStatus(`담는 중… ${i + 1}/${chosen.length}`);
        // 이미지 모음은 원본 주소가 같으면 같은 이미지로 보고 앞의 것을 지우므로, 조각 번호를 붙여 구분한다
        await ToolhubShelf.addImage(piece.blob, { from: "브랜드커넥트", source: `${piece.url}#${piece.label}` });
      }
      setStatus(`${chosen.length}장을 담았어요. 블로그 글쓰기 화면에서 "삽입"으로 [이미지: …] 자리에 넣으세요.`);
      closePicker();
    } catch (e) {
      setStatus(`담지 못했어요: ${e.message}`, true);
      updatePicked();
    }
  });

  refresh();
})();
