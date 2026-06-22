/* ════════════════════════════════════════
   SummarAI – app.js  (Groq Edition - FIXED)
   ════════════════════════════════════════ */

// ── CONFIG ──
const API_KEY = process.env.GROQ_API_KEY;  // 🔑 Replace with your Groq key
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL   = "llama-3.3-70b-versatile";

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
    return;
  }

  // TOO SHORT — same, no loading
  if (userText.length < 50) {
    showWarning("Text is too short — paste at least 50 characters.");
    return;
  }

  // KEY NOT SET
  if (API_KEY === "YOUR_GROQ_API_KEY_HERE") {
    showWarning("Add your Groq API key on line 4 of app.js. Get a free key at console.groq.com");
    return;
  }

  // All good — remove any warning and start loading
 removeWarning();
 var style = document.querySelector('input[name="summaryStyle"]:checked').value;
 showState("outputLoading");
 setButtonLoading(true);

  try{
  var summary = await callGroqAPI(userText, style);

  document.getElementById("summaryText").textContent = summary;
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
  var res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": "Bearer " + API_KEY,
    },
    body: JSON.stringify({
      model:       MODEL,
      max_tokens:  1024,
      temperature: 0.4,
      messages:    buildMessages(text, style),
    }),
  });

  if (!res.ok) {
    var err = await res.json().catch(function() { return {}; });
    var msg = (err.error && err.error.message) ? err.error.message : "";
    if (res.status === 401) throw new Error("Invalid Groq API key. Check console.groq.com → API Keys.");
    if (res.status === 429) throw new Error("Rate limit hit. Wait a moment and try again.");
    if (res.status === 400) throw new Error("Bad request: " + (msg || "Check your input."));
    throw new Error("API error " + res.status + (msg ? ": " + msg : ""));
  }

  var data = await res.json();
  return data.choices[0].message.content.trim();
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