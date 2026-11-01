const { FONT_SIZES, DEFAULT_SETTINGS, mergeSettings } = ToolhubLib;
const form = document.getElementById("form");
const saved = document.getElementById("saved");
const field = (name) => form.elements.namedItem(name);

field("heading.size").innerHTML = FONT_SIZES.map((s) => `<option value="${s}">${s}</option>`).join("");

/** 색을 끈 상태에서 색 칸에 보여줄 색 */
const PLACEHOLDER_COLORS = { heading: "#000000", emphasis: DEFAULT_SETTINGS.emphasis.color };

/** 색 칸이 꺼져 있으면 ""(색을 바꾸지 않음)로 저장한다 */
function fill(settings) {
  field("heading.size").value = String(settings.heading.size);
  for (const key of ["heading", "emphasis"]) {
    field(`${key}.bold`).checked = settings[key].bold;
    field(`${key}.useColor`).checked = !!settings[key].color;
    field(`${key}.color`).value = settings[key].color || PLACEHOLDER_COLORS[key];
  }
  field("highlight.color").value = settings.highlight.color;
}

function read() {
  const color = (key) => (field(`${key}.useColor`).checked ? field(`${key}.color`).value : "");
  return {
    heading: { size: Number(field("heading.size").value), bold: field("heading.bold").checked, color: color("heading") },
    emphasis: { bold: field("emphasis.bold").checked, color: color("emphasis") },
    highlight: { color: field("highlight.color").value },
  };
}

chrome.storage.sync.get("settings").then(({ settings }) => fill(mergeSettings(settings)));

form.addEventListener("input", async (e) => {
  // 색을 고르면 그 색을 쓰겠다는 뜻이므로 체크도 켠다
  const name = e.target.name ?? "";
  if (name.endsWith(".color") && field(name.replace(".color", ".useColor"))) field(name.replace(".color", ".useColor")).checked = true;
  await chrome.storage.sync.set({ settings: read() });
  saved.textContent = "저장했어요";
  setTimeout(() => (saved.textContent = ""), 1500);
});
