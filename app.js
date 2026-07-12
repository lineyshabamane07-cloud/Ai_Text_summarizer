/* ════════════════════════════════════════
   SummarAI – app.js  (Groq Edition - FIXED)
   ════════════════════════════════════════ */

// ── CONFIG ──
const API_URL = "/api/summarize";

// ── CHARACTER COUNTER ──
const inputTextEl = document.getElementById("inputText");
const charCountEl = document.getElementById("charCount");

inputTextEl.addEventListener("input", function () {
  charCountEl.textContent = inputTextEl.value.length;
});

// ── BUILD PROMPT ──
function buildMessages(text, style) {
  const system = "You are a professional text summarizer. Respond with only the summary. No preamble, no intro phrases.";

  const instructions = {
    short:   "Summarize the following text in 2 to 3 clear concise sentences. Capture only the most essential idea.",
    medium:  "Write a medium-length summary (one paragraph, 5 to 8 sentences) of the following text. Cover main points and key details.",
    bullets: "Summarize the following text as bullet points. Start each bullet with '• '. Include 4 to 7 key takeaways. Each bullet is one sentence.",
  };

  return [
    { role: "system", content: system },
    { role: "user",   content: (instructions[style] || instructions.short) + "\n\nText:\n\"\"\"\n" + text + "\n\"\"\"" },
  ];
}

// ── SHOW STATE (the core fix — only ONE panel visible at a time) ──
function showState(name) {
  var ids = ["outputIdle", "outputLoading", "outputError", "outputResult"];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (!el) continue;
    var show = ids[i] === name;
    el.hidden        = !show;
    el.style.display = show ? "" : "none";
  }
}

// ── BUTTON LOADING STATE ──
function setButtonLoading(loading) {
  const text = document.querySelector(".btn-text");
  const loader = document.querySelector(".btn-loader");

  if (!text || !loader) return;

  if (loading) {
    text.style.display = "none";
    loader.style.display = "inline-flex";
  } else {
    text.style.display = "inline";
    loader.style.display = "none";
  }
}
// ── MAIN HANDLER ──
async function handleSummarize() {
  var userText = inputTextEl.value.trim();

  // EMPTY — show warning below textarea, output stays idle, NO loading
  if (!userText) {
    showWarning("Please paste some text to summarize.");
    return;
}
  // TOO SHORT — same, no loading
  if (userText.length < 50) {
    showWarning("Text is too short — paste at least 50 characters.");
    return;
  }

  // All good — remove any warning and start loading
 removeWarning();
 var style = document.querySelector('input[name="summaryStyle"]:checked').value;
 showState("outputLoading");
 setButtonLoading(true);

  try{
  var summary = await callGroqAPI(userText, style);

  const summaryEl = document.getElementById("summaryText");
  summaryEl.textContent = summary;
  summaryEl.style.whiteSpace = "pre-wrap";
  document.getElementById("copyConfirm").hidden = true;

  setButtonLoading(false);
  showState("outputResult");
  } catch (err) {
    console.error("Groq error:", err);
    document.getElementById("errorMessage").textContent = err.message || "API call failed. Check the browser console.";
    showState("outputError");
  } finally {
    setButtonLoading(false);
  }
}

// ── GROQ API CALL ──
async function callGroqAPI(text, style) {
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      style
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data.summary;
}

// ── INLINE WARNING (below textarea, no output panel change) ──
function showWarning(msg) {
  removeWarning();
  var div = document.createElement("div");
  div.id = "inlineWarning";
  div.textContent = "⚠ " + msg;
  div.style.cssText =
    "background:#1f1a0e;border:1px solid #f59e0b;color:#f59e0b;" +
    "border-radius:8px;padding:10px 14px;font-size:0.84rem;margin-top:8px;";
  inputTextEl.parentNode.insertBefore(div, inputTextEl.nextSibling);
  setTimeout(removeWarning, 4000);
  inputTextEl.addEventListener("input", removeWarning, { once: true });
}

function removeWarning() {
  var el = document.getElementById("inlineWarning");
  if (el) el.remove();
}

// ── COPY ──
async function copyResult() {
  var text = document.getElementById("summaryText").textContent;
  var conf = document.getElementById("copyConfirm");
  try {
    await navigator.clipboard.writeText(text);
    conf.hidden = false;
    setTimeout(function() { conf.hidden = true; }, 2000);
  } catch(e) {
    alert("Copy failed. Select the text manually.");
  }
}

// ── CLEAR ──
function clearAll() {
  inputTextEl.value = "";
  charCountEl.textContent = "0";
  removeWarning();
    showState("outputIdle");
    setButtonLoading(false);
}

// ── KEYBOARD SHORTCUT: Ctrl+Enter / Cmd+Enter ──
document.addEventListener("keydown", function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSummarize();
});
// Initial page state
window.addEventListener("DOMContentLoaded", function () {
  showState("outputIdle");
  setButtonLoading(false);
});
// ── DOWNLOAD AS PDF ──
function downloadAsPDF() {
  const text = document.getElementById("summaryText").textContent;
  if (!text) return;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SummarAI – Summary</title>
      <style>
        body {
          font-family: Georgia, serif;
          max-width: 680px;
          margin: 60px auto;
          color: #1a1a1a;
          line-height: 1.85;
          font-size: 16px;
        }
        h1 {
          font-family: sans-serif;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .meta {
          font-size: 12px;
          color: #888;
          padding-bottom: 16px;
          margin-bottom: 24px;
          border-bottom: 1px solid #ddd;
          font-family: sans-serif;
        }
        p  { margin-bottom: 14px; }
        ul { padding-left: 20px; }
        li { margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <h1>SummarAI – Summary</h1>
      <div class="meta">
        Generated on ${new Date().toLocaleDateString("en-IN", {
          year: "numeric", month: "long", day: "numeric"
        })}
      </div>
      ${formatForHTML(text)}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

// ── DOWNLOAD AS WORD (.docx) ──
function downloadAsWord() {
  const text = document.getElementById("summaryText").textContent;
  if (!text) return;

  // Load docx library from CDN on demand
  const script = document.createElement("script");
  script.src = "https://unpkg.com/docx@8.5.0/build/index.umd.js";
  document.head.appendChild(script);

  script.onload = () => {
    const { Document, Paragraph, TextRun, HeadingLevel, Packer } = docx;

    const lines = text.split("\n").filter(l => l.trim());

    const contentParagraphs = lines.map(line => {
      const isBullet = line.trim().startsWith("•");
      const cleanLine = line.replace(/^•\s*/, "").trim();
      return new Paragraph({
        children: [new TextRun({ text: cleanLine, size: 24, font: "Georgia" })],
        bullet: isBullet ? { level: 0 } : undefined,
        spacing: { after: 160 }
      });
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: "SummarAI – Summary",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120 }
          }),
          new Paragraph({
            children: [new TextRun({
              text: `Generated on ${new Date().toLocaleDateString("en-IN", {
                year: "numeric", month: "long", day: "numeric"
              })}`,
              color: "888888",
              size: 20
            })],
            spacing: { after: 320 }
          }),
          ...contentParagraphs
        ]
      }]
    });

    Packer.toBlob(doc).then(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = "summary.docx";
      a.click();
      URL.revokeObjectURL(url);
    });
  };
}

// ── HELPER: plain text → HTML for PDF ──
function formatForHTML(text) {
  const lines = text.split("\n").filter(l => l.trim());
  const isBullets = lines.some(l => l.trim().startsWith("•"));

  if (isBullets) {
    const items = lines.map(l => `<li>${l.replace(/^•\s*/, "")}</li>`).join("");
    return `<ul>${items}</ul>`;
  }
  return lines.map(l => `<p>${l}</p>`).join("");
}
