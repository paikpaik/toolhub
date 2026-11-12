const { imageFileName } = ToolhubLib;
const { INDEX_KEY, readIndex, getRecord, addImage, removeImages, clearImages, migrate } = ToolhubShelf;
const shelfEl = document.getElementById("shelf");
const empty = document.getElementById("empty");
const statusLine = document.getElementById("status");
const drop = document.getElementById("drop");
const clearButton = document.getElementById("clear");

/** 순서 목록 (원본은 IndexedDB에 있고 칸을 그릴 때 꺼낸다) */
let shelf = [];
/** 이미 그린 칸. 목록이 바뀌면 새로 생긴 칸만 만들고 나머지는 그대로 옮긴다 */
const cards = new Map();
let statusTimer = 0;

function setStatus(text, isError = false) {
  clearTimeout(statusTimer);
  statusLine.textContent = text;
  statusLine.classList.toggle("error", isError);
  if (!isError && text) statusTimer = setTimeout(() => (statusLine.textContent = ""), 3000);
}

const autoToggle = document.getElementById("auto");

async function load() {
  const { autoCollect } = await chrome.storage.local.get("autoCollect");
  autoToggle.checked = autoCollect !== false;
  try {
    await migrate();
  } catch (e) {
    setStatus(`예전에 담은 이미지를 옮기지 못했어요: ${e.message}`, true);
  }
  shelf = await readIndex();
  render();
}

// background가 패널이 열려 있는 동안에만 자동으로 담도록 연결을 유지한다 (패널을 닫으면 끊긴다).
// background가 쉬다 꺼지면 연결도 끊기므로 다시 잇는다 (getContexts가 없는 크롬을 위한 대비)
function connectPanel() {
  chrome.runtime.connect({ name: "shelf-panel" }).onDisconnect.addListener(() => setTimeout(connectPanel, 1000));
}
connectPanel();
autoToggle.addEventListener("change", () => chrome.storage.local.set({ autoCollect: autoToggle.checked }));

// 자동 담기·오른쪽 클릭으로 담은 이미지(background.js)도 바로 보이게 한다
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[INDEX_KEY]) {
    shelf = changes[INDEX_KEY].newValue ?? [];
    render();
  }
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "shelf-status") setStatus(message.text, message.error);
});

/** 목록은 storage.onChanged로 다시 그린다 (background가 담은 것과 같은 길) */
async function add(blob, from) {
  if (!blob.type.startsWith("image/")) return setStatus("이미지가 아니에요.", true);
  try {
    await addImage(blob, { from });
    setStatus("담았어요. 클릭하면 복사돼요.");
  } catch (e) {
    setStatus(`저장하지 못했어요: ${e.message}`, true);
  }
}

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** 주소로 받기 (끌어다 놓은 이미지·붙여넣은 이미지 주소). 확장 권한이라 다른 사이트 이미지도 받을 수 있다 */
async function fetchImage(url) {
  const blob = await (await fetch(url)).blob();
  if (!blob.type.startsWith("image/")) throw new Error("이미지 주소가 아니에요");
  return blob;
}

/** 끌어다 놓기·붙여넣기 데이터에서 이미지 주소를 찾는다. HTML 속 img → uri-list → 일반 텍스트 순 */
function findImageUrl(data) {
  const html = data.getData("text/html");
  // .src는 패널 주소 기준으로 바뀌어 버리므로 속성 값 그대로 읽는다
  const fromHtml = html ? new DOMParser().parseFromString(html, "text/html").querySelector("img")?.getAttribute("src") : null;
  const fromList = data.getData("text/uri-list").split("\n").find((line) => line && !line.startsWith("#"));
  return [fromHtml, fromList, data.getData("text/plain")].map((u) => u?.trim()).find((u) => u && /^(https?:|blob:|data:image\/)/.test(u)) ?? null;
}

/** 붙여넣기·끌어다 놓기 공통: 이미지 파일 → 이미지 주소 순으로 찾는다 */
async function addFromTransfer(data) {
  const file = [...data.files].find((f) => f.type.startsWith("image/"));
  if (file) return add(file, "붙여넣기");
  const url = findImageUrl(data);
  if (!url) return setStatus("이미지를 찾지 못했어요. 사이트의 \"이미지 복사\"를 눌러 복사한 뒤 여기에 붙여넣어 주세요.", true);
  if (url.startsWith("data:")) return add(await (await fetch(url)).blob(), "붙여넣기");
  setStatus("이미지를 받는 중…");
  if (url.startsWith("http")) {
    try {
      return await add(await fetchImage(url), new URL(url).hostname);
    } catch {
      // 로그인이 필요한 이미지는 아래에서 그 페이지 안에서 다시 시도
    }
  }
  // blob: 주소는 그 이미지를 띄운 페이지 안에서만 읽을 수 있어서 background가 지금 탭에서 읽는다
  chrome.runtime.sendMessage({ type: "shelf-add-url", url });
}

document.addEventListener("paste", (e) => {
  e.preventDefault();
  addFromTransfer(e.clipboardData);
});
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  addFromTransfer(e.dataTransfer);
});

/** 원본 이미지 (미리보기 말고). 지워졌으면 오류 */
async function original(item) {
  const record = await getRecord(item.id);
  if (!record) throw new Error("이미지를 찾지 못했어요");
  return record.image;
}

/** 클립보드 이미지는 PNG만 받아서 PNG로 바꿔 넣는다 */
async function copyImage(item) {
  let blob = await original(item);
  if (blob.type !== "image/png") {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    blob = await canvas.convertToBlob({ type: "image/png" });
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

async function download(item) {
  try {
    const blob = await original(item);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = imageFileName(new Date(item.id), blob.type);
    link.click();
    // 바로 풀면 내려받기가 시작되기 전에 주소가 사라질 수 있다
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    setStatus(`저장하지 못했어요: ${e.message}`, true);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const IS_MAC = /Mac/i.test(navigator.platform);

/** debugger로 보내는 진짜 키 입력 (에디터는 확장이 만든 키 이벤트를 받지 않는다) */
async function pressKey(send, key, code, keyCode, { modifiers = 0, commands } = {}) {
  const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers };
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base, ...(commands ? { commands } : {}) });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}

/** debugger로 보내는 진짜 마우스 드래그 (from → to). 끄는 동안 몇 번 나눠 움직여 에디터가 드래그로 알아보게 한다 */
async function drag(send, from, to) {
  const mouse = (type, p, extra) => send("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, ...extra });
  await mouse("mouseMoved", from, { button: "none" });
  await mouse("mousePressed", from, { button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 4; i++) {
    await mouse("mouseMoved", { x: from.x + ((to.x - from.x) * i) / 4, y: from.y + ((to.y - from.y) * i) / 4 }, { button: "left", buttons: 1 });
  }
  await mouse("mouseReleased", to, { button: "left", buttons: 0, clickCount: 1 });
}

/**
 * 지금 보고 있는 네이버 글쓰기 탭에서, 위에서부터 첫 번째 본문 이미지 자리([이미지: …] 문단)에 이 이미지를 넣는다.
 * 실제 에디터는 확장이 만든 키 입력·선택을 받지 않아서(2026-11-12) 사람이 하듯 진짜 입력(debugger 권한)으로 한다:
 * 클립보드에 복사 → 표시 문단 드래그 → 백스페이스 → 표시 문단만 지워졌는지 확인(아니면 ⌘Z로 되돌림) → 붙여넣기.
 * 하는 동안 크롬 위에 "디버깅을 시작함" 띠가 잠깐 뜬다. 자동으로 못 넣어도 클립보드에 남아 있어 ⌘V로 붙여넣을 수 있다
 */
async function insert(item) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith("https://blog.naver.com/")) return setStatus("네이버 블로그 글쓰기 화면을 띄워 두고 눌러 주세요.", true);
  try {
    await copyImage(item);
  } catch (e) {
    return setStatus(`복사하지 못했어요: ${e.message}`, true);
  }
  setStatus("이미지 자리에 넣는 중…");
  const step = async (name) => {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "image-insert-step", step: name }).catch(() => null);
    if (!response) throw new Error("글쓰기 화면이 응답하지 않아요. 확장을 새로고침했다면 글쓰기 탭도 새로고침해 주세요");
    if (response.error) throw new Error(response.error);
    return response.result;
  };
  const target = { tabId: tab.id };
  try {
    await chrome.debugger.attach(target, "1.3");
  } catch (e) {
    return setStatus(`글쓰기 화면에 연결하지 못했어요 (${e.message}). 이미지는 복사돼 있으니 자리에서 ⌘V로 붙여넣어 주세요.`, true);
  }
  const send = (method, params) => chrome.debugger.sendCommand(target, method, params);
  try {
    // 패널에 포커스가 있어도 글쓰기 화면이 입력을 받게 한다
    await send("Emulation.setFocusEmulationEnabled", { enabled: true });
    // 디버깅 띠가 뜨며 화면이 밀린 뒤에 좌표를 잰다
    await sleep(400);
    const { start, end } = await step("locate");
    await drag(send, start, end);
    await sleep(150);
    await pressKey(send, "Backspace", "Backspace", 8);
    let status = "unchanged";
    for (let i = 0; i < 10 && status === "unchanged"; i++) {
      await sleep(100);
      status = await step("check");
    }
    if (status === "changed") {
      await pressKey(send, "z", "KeyZ", 90, { modifiers: IS_MAC ? 4 : 2, commands: ["undo"] });
      throw new Error("[이미지: …] 문단 말고 다른 글자가 바뀌어서 되돌렸어요 (바뀐 글이 있으면 ⌘Z로 확인해 주세요)");
    }
    if (status === "unchanged") throw new Error("[이미지: …] 문단을 지우지 못했어요");
    const { left } = await step("paste");
    setStatus(left ? `넣었어요. 남은 본문 이미지 자리 ${left}개.` : "넣었어요. 본문 이미지 자리를 모두 채웠어요.");
  } catch (e) {
    setStatus(`${e.message}. 이미지는 복사돼 있으니 자리에서 ⌘V로 붙여넣어 주세요.`, true);
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

async function remove(id) {
  try {
    await removeImages([id]);
  } catch (e) {
    setStatus(`지우지 못했어요: ${e.message}`, true);
  }
}

/** 칸 하나. 처음엔 작은 미리보기를 보여 주고, 마우스를 올리면 원본으로 바꿔 둔다 (에디터로 끌어다 놓을 때 원본이 가게) */
function createCard(item) {
  const figure = document.createElement("figure");
  figure.innerHTML = `
    <button type="button" class="thumb" title="클릭하면 복사 · 에디터로 끌어다 놓아도 돼요"><img alt="" loading="lazy" decoding="async" /></button>
    <div class="actions">
      <button type="button" data-action="copy">복사</button>
      <button type="button" data-action="save">저장</button>
      <button type="button" data-action="insert" title="네이버 글쓰기 화면에서 위에서부터 첫 번째 [이미지: …] 자리에 넣어요 (대표 썸네일 자리는 건너뜀)">삽입</button>
      <button type="button" class="link remove" data-action="remove" aria-label="지우기">✕</button>
    </div>`;
  const img = figure.querySelector("img");
  let preview = "";
  getRecord(item.id)
    .then((record) => {
      if (!record) return;
      preview = URL.createObjectURL(record.thumb ?? record.image);
      img.src = preview;
    })
    .catch(() => {});
  const thumb = figure.querySelector(".thumb");
  thumb.addEventListener(
    "pointerenter",
    async () => {
      try {
        // 예전처럼 data URL로 둔다 (확장 안의 blob: 주소는 에디터가 읽지 못한다)
        img.src = await readFile(await original(item));
      } catch {
        // 미리보기 그대로
      }
    },
    { once: true },
  );
  const copy = async () => {
    try {
      await copyImage(item);
      setStatus("복사했어요. 에디터에서 ⌘V(Ctrl+V)로 붙여넣으세요.");
    } catch (e) {
      setStatus(`복사하지 못했어요: ${e.message}`, true);
    }
  };
  thumb.addEventListener("click", copy);
  figure.querySelector('[data-action="copy"]').addEventListener("click", copy);
  figure.querySelector('[data-action="save"]').addEventListener("click", () => download(item));
  figure.querySelector('[data-action="insert"]').addEventListener("click", () => insert(item));
  figure.querySelector('[data-action="remove"]').addEventListener("click", () => remove(item.id));
  return { figure, release: () => preview && URL.revokeObjectURL(preview) };
}

/** 목록에서 빠진 칸은 치우고, 새 칸만 만들고, 나머지는 순서만 맞춘다 (이미 그린 이미지는 다시 읽지 않는다) */
function render() {
  empty.hidden = shelf.length > 0;
  clearButton.hidden = shelf.length === 0;
  const ids = new Set(shelf.map((item) => item.id));
  for (const [id, card] of cards) {
    if (ids.has(id)) continue;
    card.release();
    cards.delete(id);
  }
  shelfEl.replaceChildren(
    ...shelf.map((item) => {
      if (!cards.has(item.id)) cards.set(item.id, createCard(item));
      return cards.get(item.id).figure;
    }),
  );
}

clearButton.addEventListener("click", async () => {
  if (!confirm(`담아 둔 이미지 ${shelf.length}개를 모두 지울까요?`)) return;
  try {
    await clearImages();
  } catch (e) {
    setStatus(`지우지 못했어요: ${e.message}`, true);
  }
});

document.getElementById("options").addEventListener("click", () => chrome.runtime.openOptionsPage());

// 드래그 서식 버튼이 동작하지 않을 때, 지금 에디터의 버튼 구조(글 내용 제외)를 복사해 naver-editor.js를 고칠 수 있게 한다
document.getElementById("diagnose").addEventListener("click", async () => {
  setStatus("에디터를 살펴보는 중…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // 에디터를 못 찾았을 때도 원인을 알 수 있게, 모든 프레임에서 확장이 들어갔는지와 편집 영역·선택 상태를 모은다 (글 내용은 담지 않음)
    const frames = (
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          const editable = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""]')];
          const selection = getSelection();
          const anchor = selection?.anchorNode?.nodeType === 1 ? selection.anchorNode : selection?.anchorNode?.parentElement;
          const classOf = (el) => (typeof el?.className === "string" ? el.className.slice(0, 120) : "");
          const parents = [];
          for (let p = anchor?.parentElement; p && parents.length < 4; p = p.parentElement) parents.push(classOf(p));
          return {
            url: location.origin + location.pathname,
            contentScript: document.documentElement.dataset.toolhubContent === "1",
            seContent: !!document.querySelector(".se-content"),
            seToolbar: !!document.querySelector(".se-toolbar"),
            editable: editable.slice(0, 5).map((el) => ({ tag: el.tagName, class: classOf(el) })),
            selection: selection ? { collapsed: selection.isCollapsed, length: selection.toString().length, anchorClass: classOf(anchor), anchorParents: parents } : null,
          };
        },
      })
    ).map((r) => r.result);
    const editor = await chrome.tabs.sendMessage(tab.id, { type: "diagnose" }).catch(() => null);
    await navigator.clipboard.writeText(JSON.stringify({ frames, editor }, null, 2));
    setStatus("진단 정보를 복사했어요. Claude에게 붙여넣어 주세요.");
  } catch (e) {
    setStatus(`진단하지 못했어요 (${e.message}). 네이버 블로그 글쓰기 화면에서 눌러 주세요.`, true);
  }
});

load();
