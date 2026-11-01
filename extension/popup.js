const message = document.getElementById("message");

document.getElementById("options").addEventListener("click", () => chrome.runtime.openOptionsPage());

// 버튼이 동작하지 않을 때, 지금 에디터의 버튼 구조(글 내용 제외)를 복사해 naver-editor.js를 고칠 수 있게 한다
document.getElementById("diagnose").addEventListener("click", async () => {
  message.textContent = "에디터를 살펴보는 중…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const info = await chrome.tabs.sendMessage(tab.id, { type: "diagnose" });
    if (!info) throw new Error("no editor");
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    message.textContent = "복사했어요. Claude에게 붙여넣어 주세요.";
  } catch {
    message.textContent = "네이버 블로그 글쓰기 화면에서 눌러 주세요. 확장 프로그램을 설치하기 전에 열어 둔 탭이면 새로고침이 필요해요.";
  }
});
