/**
 * 패널의 초안 메뉴: toolhub 웹(localhost)에서 그날 올릴 네이버 초안을 (계정이 등록돼 있으면 고른 계정 것만) 불러와, 네이버 새 글쓰기 화면에
 * 제목 → 본문(서식 포함 복사와 같은 HTML, 맨 아래 빈 줄 5개 + #태그 줄) → 소제목 정리 → 대표 썸네일(계정 썸네일, 끌 수 있음)까지 채운다.
 * 저장(임시저장)·발행은 사람이 누른다.
 * 에디터는 확장이 만든 입력을 받지 않아서(2026-11-12) 클릭·제목 입력은 이미지 삽입처럼 debugger로 진짜 입력을 보낸다.
 * sidepanel.js와 같은 전역에서 돌므로 이름이 겹치지 않게 감싼다
 */
(() => {
  const { fillProblem, sameText } = ToolhubLib;
  const $ = (id) => document.getElementById(id);
  const dateInput = $("drafts-date");
  const accountRow = $("drafts-account-row");
  const accountSelect = $("drafts-account");
  /** 고른 계정은 크롬 프로필마다 기억한다 (계정마다 프로필을 따로 써도, 한 프로필에서 바꿔 가며 써도 된다) */
  const ACCOUNT_KEY = "draftsAccount";
  const thumbnailToggle = $("drafts-thumbnail");
  const THUMBNAIL_KEY = "draftsThumbnail";
  chrome.storage.local.get(THUMBNAIL_KEY).then((saved) => (thumbnailToggle.checked = saved[THUMBNAIL_KEY] !== false));
  thumbnailToggle.addEventListener("change", () => chrome.storage.local.set({ [THUMBNAIL_KEY]: thumbnailToggle.checked }));
  const RENDER_TIMEOUT_MS = 20_000;
  const list = $("drafts-list");
  const statusLine = $("drafts-status");

  /** 사용자가 직접 띄운 웹(npm run web, 3000)을 먼저, 없으면 MCP open_web이 띄운 웹(3100) */
  const WEB_BASES = ["http://localhost:3000", "http://localhost:3100"];
  let web = null;
  let busy = false;

  function setStatus(text, isError = false) {
    statusLine.textContent = text;
    statusLine.classList.toggle("error", isError);
  }

  const todayKst = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** toolhub 웹에 묻는다. 처음엔 켜져 있고 이 기능이 있는(옛 버전은 404) 웹을 찾아 기억한다 */
  async function api(path) {
    for (const base of web ? [web] : WEB_BASES) {
      let res;
      try {
        res = await fetch(base + path);
      } catch {
        continue;
      }
      if (res.status === 404 && !web) continue;
      const data = await res.json().catch(() => ({ error: `웹 응답을 읽지 못했어요 (${res.status})` }));
      if (!res.ok) throw new Error(data.error ?? `웹 오류 (${res.status})`);
      web = base;
      return data;
    }
    web = null;
    throw new Error("toolhub 웹이 꺼져 있어요. 터미널에서 npm run web을 켜거나 Claude 앱에 \"toolhub 웹 열어줘\"라고 해 주세요");
  }

  /** 웹에 등록된 계정으로 계정 고르기를 채운다. 계정이 없거나 옛 웹(계정 기능 없음)이면 숨기고 모든 초안을 보여 준다 */
  async function loadAccounts() {
    let accounts = [];
    try {
      ({ accounts } = await api("/api/accounts"));
    } catch {
      // 웹이 꺼져 있으면 초안 목록을 부를 때 알린다
    }
    accountRow.hidden = !accounts.length;
    if (!accounts.length) return accountSelect.replaceChildren();
    const { [ACCOUNT_KEY]: saved } = await chrome.storage.local.get(ACCOUNT_KEY);
    const options = [["", "모든 계정"], ...accounts.map((a) => [a.id, a.name]), ["none", "계정 없음"]];
    accountSelect.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
    accountSelect.value = options.some(([value]) => value === saved) ? saved : "";
  }

  async function load() {
    list.replaceChildren();
    setStatus("초안을 불러오는 중…");
    try {
      const account = accountRow.hidden ? "" : accountSelect.value;
      const { drafts } = await api(`/api/drafts/naver?date=${dateInput.value}${account ? `&account=${encodeURIComponent(account)}` : ""}`);
      setStatus(drafts.length ? "" : `이 날 올릴 ${account ? `${accountSelect.selectedOptions[0]?.text} ` : ""}네이버 초안이 없어요 (발행됨은 빼고 보여요).`);
      list.replaceChildren(
        ...drafts.map((draft) => {
          const item = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          button.title = "새 글쓰기 화면에 제목·본문을 채워요";
          button.innerHTML = `<span>${draft.format === "home" ? '<span class="chip" title="홈판형: 아침에 먼저 올려요">홈판</span>' : ""}<b></b></span><small></small>`;
          button.querySelector("b").textContent = draft.title;
          button.querySelector("small").textContent = draft.keyword;
          button.addEventListener("click", () => fill(draft));
          item.append(button);
          return item;
        }),
      );
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  /**
   * 웹의 썸네일 화면(/blog/thumbnail/render)을 보이지 않는 iframe으로 열어 이 초안의 썸네일 PNG(data URL)를 받는다.
   * 웹 미리보기와 같은 그리기 코드·글꼴로 그리게 하려고 확장이 직접 그리지 않는다
   */
  function renderThumbnail(file) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.className = "render-frame";
      frame.setAttribute("aria-hidden", "true");
      const finish = (error, png) => {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        frame.remove();
        if (error) reject(error);
        else resolve(png);
      };
      const onMessage = (e) => {
        if (e.origin !== web || e.data?.type !== "toolhub-thumbnail" || e.data.file !== file) return;
        finish(e.data.error ? new Error(e.data.error) : null, e.data.png);
      };
      const timer = setTimeout(() => finish(new Error("썸네일을 그리는 데 너무 오래 걸려요")), RENDER_TIMEOUT_MS);
      window.addEventListener("message", onMessage);
      frame.src = `${web}/blog/thumbnail/render?file=${encodeURIComponent(file)}`;
      document.body.append(frame);
    });
  }

  /** 대표 썸네일 자리에 썸네일을 넣는다. 결과 문장(넣었으면 "대표 썸네일", 못 넣었으면 이유) */
  async function fillThumbnail(tab, rendering) {
    try {
      const png = await rendering;
      const blob = await (await fetch(png)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("대표 썸네일을 넣는 중…");
      await insertClipboardImage(tab, "thumbnail");
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e.message ?? e).replace(/[.]$/, "") };
    }
  }

  /** debugger로 보내는 진짜 마우스 클릭 */
  async function click(send, p) {
    const mouse = (type, extra) => send("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, button: "left", ...extra });
    await mouse("mouseMoved", { button: "none" });
    await mouse("mousePressed", { buttons: 1, clickCount: 1 });
    await mouse("mouseReleased", { buttons: 0, clickCount: 1 });
  }

  async function fill(draft) {
    if (busy) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.startsWith("https://blog.naver.com/")) return setStatus("네이버 블로그 새 글쓰기 화면을 띄워 두고 눌러 주세요.", true);
    busy = true;
    list.querySelectorAll("button").forEach((b) => (b.disabled = true));

    const step = async (name, which) => {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "draft-fill-step", step: name, which }).catch(() => null);
      if (!response) throw new Error("글쓰기 화면이 응답하지 않아요. 확장을 새로고침했다면 글쓰기 탭도 새로고침해 주세요");
      if (response.error) throw new Error(response.error);
      return response.result;
    };
    const target = { tabId: tab.id };
    let attached = false;
    try {
      setStatus("초안을 받는 중…");
      const content = await api(`/api/drafts/naver/fill?file=${encodeURIComponent(draft.file)}`);
      // 썸네일은 본문을 채우는 동안 미리 그려 둔다 (실패는 썸네일 단계에서 알린다)
      const rendering = thumbnailToggle.checked && content.thumbnail ? renderThumbnail(draft.file) : null;
      rendering?.catch(() => {});
      const problem = fillProblem(await step("state"));
      if (problem) throw new Error(problem);
      // 본문은 진짜 붙여넣기로 넣으므로 클립보드에 먼저 담는다 (패널을 누른 직후라야 쓸 수 있다)
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([content.html], { type: "text/html" }),
          "text/plain": new Blob([content.text], { type: "text/plain" }),
        }),
      ]);

      await chrome.debugger.attach(target, "1.3");
      attached = true;
      const send = (method, params) => chrome.debugger.sendCommand(target, method, params);
      // 패널에 포커스가 있어도 글쓰기 화면이 입력을 받게 하고, 디버깅 띠가 뜨며 화면이 밀린 뒤에 좌표를 잰다
      await send("Emulation.setFocusEmulationEnabled", { enabled: true });
      await wait(400);

      setStatus("제목을 넣는 중…");
      await click(send, await step("locate", "title"));
      await wait(200);
      if (!(await step("caret", "title"))) throw new Error("제목 칸에 커서가 들어가지 않았어요");
      await send("Input.insertText", { text: content.title });
      await wait(300);
      const { title } = await step("state");
      if (!sameText(title, content.title)) throw new Error("제목이 다르게 들어갔어요. 제목 칸을 확인해 주세요");

      setStatus("본문을 붙여넣는 중…");
      await click(send, await step("locate", "body"));
      await wait(200);
      if (!(await step("caret", "body"))) throw new Error("본문 칸에 커서가 들어가지 않았어요. 제목은 들어가 있어요");
      const { length, slots } = await step("paste");
      await chrome.debugger.detach(target).catch(() => {});
      attached = false;

      setStatus("소제목을 정리하는 중…");
      const headings = await step("headings");
      const thumbnail = rendering ? await fillThumbnail(tab, rendering) : null;
      setStatus(
        [
          `채웠어요: 본문 ${length.toLocaleString()}자, 소제목 ${headings}개${content.tags.length ? `, 맨 아래 태그 ${content.tags.length}개` : ""}${thumbnail?.ok ? ", 대표 썸네일" : ""}.`,
          thumbnail && !thumbnail.ok ? `썸네일은 넣지 못했어요 (${thumbnail.reason}). 웹 초안 화면의 자동 썸네일을 복사해 넣어 주세요.` : "",
          slots ? `이미지 자리 ${slots}곳은 이미지 모음의 "삽입"으로 넣어 주세요.` : "",
          "확인한 뒤 저장·발행은 직접 눌러 주세요.",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (e) {
      setStatus(/[.)]$/.test(e.message) ? e.message : `${e.message}.`, true);
    } finally {
      if (attached) await chrome.debugger.detach(target).catch(() => {});
      busy = false;
      list.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  }

  $("drafts-reload").addEventListener("click", load);
  dateInput.addEventListener("change", load);
  accountSelect.addEventListener("change", () => {
    chrome.storage.local.set({ [ACCOUNT_KEY]: accountSelect.value });
    load();
  });
  // 메뉴를 열 때마다 새로 불러온다 (Claude 앱이 그사이 초안을 더 저장했거나 계정을 바꿨을 수 있다)
  $("tab-drafts-button").addEventListener("click", async () => {
    if (!dateInput.value) dateInput.value = todayKst();
    await loadAccounts();
    load();
  });
})();
