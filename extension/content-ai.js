/**
 * Gemini·ChatGPT·AI Studio에서 새로 생성된 이미지를 이미지 모음 패널로 자동으로 보낸다.
 * 실제로 담을지는 background가 정한다 (패널이 열려 있고 "자동으로 담기"가 켜져 있을 때만).
 */
(() => {
  /** 생성 중에는 흐린 미리보기가 몇 번 바뀌므로, 주소가 이만큼 그대로일 때 완성으로 본다 */
  const SETTLE_MS = 2500;
  const sent = new Set();
  const timers = new WeakMap();

  const readAsDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  /** 페이지 안에서 읽어야 blob: 주소와 로그인이 필요한 주소도 받을 수 있다. 실패하면 null (background가 다시 시도) */
  async function read(src) {
    try {
      const blob = await (await fetch(src, { credentials: "include" })).blob();
      return blob.type.startsWith("image/") ? await readAsDataUrl(blob) : null;
    } catch {
      return null;
    }
  }

  async function check(img, src) {
    if (!img.isConnected || (img.currentSrc || img.src) !== src || sent.has(src)) return;
    if (!ToolhubLib.isLargeImage(img.naturalWidth, img.naturalHeight)) return;
    sent.add(src);
    const dataUrl = await read(src);
    chrome.runtime.sendMessage({ type: "shelf-auto", src, dataUrl, from: location.hostname }).catch(() => {});
  }

  // 이미지 load 이벤트는 위로 전파되지 않아서 캡처 단계에서 받는다. 주소가 바뀌면 다시 load가 와서 타이머가 새로 걸린다
  document.addEventListener(
    "load",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:image/svg")) return;
      clearTimeout(timers.get(img));
      timers.set(img, setTimeout(() => check(img, src), SETTLE_MS));
    },
    true,
  );
})();
