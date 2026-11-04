const { addToShelf, dataUrlMime, imageFileName } = ToolhubLib;
const shelfEl = document.getElementById("shelf");
const empty = document.getElementById("empty");
const statusLine = document.getElementById("status");
const drop = document.getElementById("drop");
const clearButton = document.getElementById("clear");

let shelf = [];
let statusTimer = 0;

function setStatus(text, isError = false) {
  clearTimeout(statusTimer);
  statusLine.textContent = text;
  statusLine.classList.toggle("error", isError);
  if (!isError && text) statusTimer = setTimeout(() => (statusLine.textContent = ""), 3000);
}

const autoToggle = document.getElementById("auto");

async function load() {
  let autoCollect;
  ({ shelf = [], autoCollect } = await chrome.storage.local.get(["shelf", "autoCollect"]));
  autoToggle.checked = autoCollect !== false;
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
  if (area === "local" && changes.shelf) {
    shelf = changes.shelf.newValue ?? [];
    render();
  }
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "shelf-status") setStatus(message.text, message.error);
});

async function add(src, from) {
  if (!dataUrlMime(src)) return setStatus("이미지가 아니에요.", true);
  shelf = addToShelf(shelf, { id: Date.now(), src, from, addedAt: new Date().toISOString() });
  await save();
  render();
  setStatus("담았어요. 클릭하면 복사돼요.");
}

async function save() {
  try {
    await chrome.storage.local.set({ shelf });
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
  return readFile(blob);
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
  if (file) return add(await readFile(file), "붙여넣기");
  const url = findImageUrl(data);
  if (!url) return setStatus("이미지를 찾지 못했어요. 사이트의 \"이미지 복사\"를 눌러 복사한 뒤 여기에 붙여넣어 주세요.", true);
  if (url.startsWith("data:")) return add(url, "붙여넣기");
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

/** 클립보드 이미지는 PNG만 받아서 PNG로 바꿔 넣는다 */
async function copyImage(item) {
  let blob = await (await fetch(item.src)).blob();
  if (blob.type !== "image/png") {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    blob = await canvas.convertToBlob({ type: "image/png" });
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

function download(item) {
  const link = document.createElement("a");
  link.href = item.src;
  link.download = imageFileName(new Date(item.id), dataUrlMime(item.src));
  link.click();
}

async function remove(id) {
  shelf = shelf.filter((s) => s.id !== id);
  await save();
  render();
}

function render() {
  empty.hidden = shelf.length > 0;
  clearButton.hidden = shelf.length === 0;
  shelfEl.replaceChildren(
    ...shelf.map((item) => {
      const figure = document.createElement("figure");
      figure.innerHTML = `
        <button type="button" class="thumb" title="클릭하면 복사 · 에디터로 끌어다 놓아도 돼요"><img alt="" /></button>
        <div class="actions">
          <button type="button" data-action="copy">복사</button>
          <button type="button" data-action="save">저장</button>
          <button type="button" class="link remove" data-action="remove" aria-label="지우기">✕</button>
        </div>`;
      figure.querySelector("img").src = item.src;
      const copy = async () => {
        try {
          await copyImage(item);
          setStatus("복사했어요. 에디터에서 ⌘V(Ctrl+V)로 붙여넣으세요.");
        } catch (e) {
          setStatus(`복사하지 못했어요: ${e.message}`, true);
        }
      };
      figure.querySelector(".thumb").addEventListener("click", copy);
      figure.querySelector('[data-action="copy"]').addEventListener("click", copy);
      figure.querySelector('[data-action="save"]').addEventListener("click", () => download(item));
      figure.querySelector('[data-action="remove"]').addEventListener("click", () => remove(item.id));
      return figure;
    }),
  );
}

clearButton.addEventListener("click", async () => {
  if (!confirm(`담아 둔 이미지 ${shelf.length}개를 모두 지울까요?`)) return;
  shelf = [];
  await save();
  render();
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
