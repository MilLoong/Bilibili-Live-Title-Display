const DEFAULTS = {
  fontSize: 13,
  color: "#fb7299",
};

const fontSizeInput = document.getElementById("fontSize");
const fontSizeValue = document.getElementById("fontSizeValue");
const colorInput = document.getElementById("color");
const colorText = document.getElementById("colorText");
const preview = document.getElementById("preview");
const resetBtn = document.getElementById("reset");

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(251, 114, 153, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

function normalizeHex(value) {
  const v = (value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return null;
}

function applyPreview({ fontSize, color }) {
  preview.style.fontSize = `${fontSize}px`;
  preview.style.color = color;
  preview.style.borderLeftColor = color;
  preview.style.background = hexToRgba(color, 0.12);
  fontSizeValue.textContent = String(fontSize);
  fontSizeInput.value = String(fontSize);
  colorInput.value = color;
  colorText.value = color;
}

function save(partial) {
  chrome.storage.sync.set(partial);
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (data) => {
    applyPreview({
      fontSize: Number(data.fontSize) || DEFAULTS.fontSize,
      color: data.color || DEFAULTS.color,
    });
  });
}

fontSizeInput.addEventListener("input", () => {
  const fontSize = Number(fontSizeInput.value);
  fontSizeValue.textContent = String(fontSize);
  preview.style.fontSize = `${fontSize}px`;
  save({ fontSize });
});

colorInput.addEventListener("input", () => {
  const color = colorInput.value;
  colorText.value = color;
  preview.style.color = color;
  preview.style.borderLeftColor = color;
  preview.style.background = hexToRgba(color, 0.12);
  save({ color });
});

colorText.addEventListener("change", () => {
  const color = normalizeHex(colorText.value);
  if (!color) {
    colorText.value = colorInput.value;
    return;
  }
  colorInput.value = color;
  colorText.value = color;
  preview.style.color = color;
  preview.style.borderLeftColor = color;
  preview.style.background = hexToRgba(color, 0.12);
  save({ color });
});

resetBtn.addEventListener("click", () => {
  chrome.storage.sync.set(DEFAULTS, () => applyPreview(DEFAULTS));
});

load();
