/* ════════════════════════════════════════
   SummarAI – app.js
   Includes: Summarizer + Chat with session memory
   ════════════════════════════════════════ */

// ── CONFIG ──
const API_URL = "/api/summarize";

// ════════════════════════════════════════
// SECTION 1 — SUMMARIZER (unchanged logic)
// ════════════════════════════════════════

const inputTextEl = document.getElementById("inputText");
const charCountEl = document.getElementById("charCount");

inputTextEl.addEventListener("input", function () {
  charCountEl.textContent = inputTextEl.value.length;
});

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

function setButtonLoading(loading) {
  const text   = document.querySelector(".btn-text");
  const loader = document.querySelector(".btn-loader");
  if (!text || !loader) return;
  if (loading) {
    text.style.display   = "none";
    loader.style.display = "inline-flex";
  } else {
    text.style.display   = "inline";
    loader.style.display = "none";
  }
}

async function handleSummarize() {
  var userText = inputTextEl.value.trim();

  if (!userText) {
    showWarning("Please paste some text to summarize.");
    return;
  }
  if (userText.length < 50) {
    showWarning("Text is too short — paste at least 50 characters.");
    return;
  }

  removeWarning();
  var style = document.querySelector('input[name="summaryStyle"]:checked').value;
  showState("outputLoading");
  setButtonLoading(true);

  try {
    var summary = await callGroqAPI(userText, style);

    const summaryEl = document.getElementById("summaryText");
    summaryEl.textContent    = summary;
    summaryEl.style.whiteSpace = "pre-wrap";
    document.getElementById("copyConfirm").hidden = true;

    setButtonLoading(false);
    showState("outputResult");

    // ── Hand off to chat system ──
    // Store original text + summary so chat knows full context
    initChat(userText, summary);

  } catch (err) {
    console.error("Groq error:", err);
    document.getElementById("errorMessage").textContent = err.message || "API call failed.";
    showState("outputError");
  } finally {
    setButtonLoading(false);
  }
}

async function callGroqAPI(text, style) {
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, style })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data.summary;
}

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

async function copyResult() {
  var text = document.getElementById("summaryText").textContent;
  var conf = document.getElementById("copyConfirm");
  try {
    await navigator.clipboard.writeText(text);
    conf.hidden = false;
    setTimeout(function () { conf.hidden = true; }, 2000);
  } catch (e) {
    alert("Copy failed. Select the text manually.");
  }
}

function clearAll() {
  inputTextEl.value        = "";
  charCountEl.textContent  = "0";
  removeWarning();
  showState("outputIdle");
  setButtonLoading(false);
  // Also hide and reset the chat
  resetChatState();
}

document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSummarize();
});

window.addEventListener("DOMContentLoaded", function () {
  showState("outputIdle");
  setButtonLoading(false);
});


// ════════════════════════════════════════════════════════════
// SECTION 2 — CHAT SYSTEM WITH SESSION MEMORY
//
// How memory works:
//   - chatHistory[] holds every message {role, content}
//   - On each new user question, we send the FULL history to
//     the API so the AI remembers previous turns
//   - The system prompt always includes the original text
//     AND the summary so the AI knows exactly what the
//     user is referring to
//   - All memory lives in JS variables — it automatically
//     clears when the tab is closed or page is refreshed
//     (no localStorage, no cookies)
// ════════════════════════════════════════════════════════════

// In-memory store — cleared automatically on page close
let chatHistory        = [];   // [{role:"user"|"assistant", content:"..."}]
let chatOriginalText   = "";   // the full text the user pasted
let chatSummary        = "";   // the summary that was generated

// DOM refs for chat
const chatSection  = document.getElementById("chatSection");
const chatMessages = document.getElementById("chatMessages");
const chatInput    = document.getElementById("chatInput");
const chatSendBtn  = document.getElementById("chatSendBtn");

// ── Called by handleSummarize() after a summary is ready ──
function initChat(originalText, summary) {
  // Reset memory for the new summary
  chatHistory      = [];
  chatOriginalText = originalText;
  chatSummary      = summary;

  // Clear old messages and show empty state
  chatMessages.innerHTML = "";
  appendChatEmpty();

  // Show the chat section (was hidden)
  chatSection.hidden        = false;
  chatSection.style.display = "flex";

  // Smooth scroll down to it
  setTimeout(() => {
    chatSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 150);
}

// ── Reset chat without hiding (used by clearAll) ──
function resetChatState() {
  chatHistory      = [];
  chatOriginalText = "";
  chatSummary      = "";
  chatMessages.innerHTML = "";
  chatSection.hidden        = true;
  chatSection.style.display = "none";
}

// ── Clear just the chat history but keep the summary context ──
function clearChat() {
  chatHistory = [];
  chatMessages.innerHTML = "";
  appendChatEmpty();
  chatInput.focus();
}

// ── Empty state placeholder ──
function appendChatEmpty() {
  chatMessages.innerHTML = `
    <div class="chat-empty">
      <div class="chat-empty-icon">💬</div>
      <p>No messages yet.<br/>Ask anything about the summary above.</p>
    </div>`;
}

// ── Send button click ──
async function sendChatMessage() {
  const question = chatInput.value.trim();
  if (!question) return;

  // Remove empty state placeholder if present
  const emptyEl = chatMessages.querySelector(".chat-empty");
  if (emptyEl) emptyEl.remove();

  // Clear input and auto-resize
  chatInput.value = "";
  autoResizeChatInput();

  // Append user bubble
  appendMessage("user", question);

  // Disable send while waiting
  setChatLoading(true);

  // Show typing indicator
  const typingId = appendTypingIndicator();

  try {
    // Add user turn to memory
    chatHistory.push({ role: "user", content: question });

    // Call the chat API with full history
    const reply = await callChatAPI(chatHistory);

    // Remove typing indicator
    removeTypingIndicator(typingId);

    // Add AI reply to memory
    chatHistory.push({ role: "assistant", content: reply });

    // Render AI bubble
    appendMessage("ai", reply);

  } catch (err) {
    removeTypingIndicator(typingId);
    appendMessage("ai", "⚠ Sorry, something went wrong: " + (err.message || "Unknown error. Please try again."));
    // Remove the failed user turn from history so it doesn't corrupt future turns
    chatHistory.pop();
  } finally {
    setChatLoading(false);
  }
}

// ── API call for chat ──
// Sends: system prompt (with original text + summary) + full conversation history
async function callChatAPI(history) {
  // The system prompt gives the AI all the context it needs
  const systemPrompt =
    "You are a helpful assistant that answers questions about a specific piece of text and its summary.\n\n" +
    "ORIGINAL TEXT:\n\"\"\"\n" + chatOriginalText + "\n\"\"\"\n\n" +
    "SUMMARY THAT WAS GENERATED:\n\"\"\"\n" + chatSummary + "\n\"\"\"\n\n" +
    "Answer the user's questions based on the original text and summary above. " +
    "Be concise and accurate. If the question is unrelated to this text, politely say so.";

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: systemPrompt,
      messages: history          // full history = memory
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Chat API failed");
  return data.reply;
}

// ── Render a message bubble ──
function appendMessage(role, text) {
  const isUser  = role === "user";
  const avatar  = isUser ? "You" : "✦";
  const msgDiv  = document.createElement("div");
  msgDiv.className = `chat-msg ${role}`;
  msgDiv.innerHTML = `
    <div class="chat-msg-avatar">${avatar}</div>
    <div class="chat-msg-bubble">${escapeHTML(text)}</div>`;
  chatMessages.appendChild(msgDiv);
  scrollChatToBottom();
}

// ── Typing indicator (3 bouncing dots) ──
function appendTypingIndicator() {
  const id     = "typing-" + Date.now();
  const msgDiv = document.createElement("div");
  msgDiv.className = "chat-msg ai typing";
  msgDiv.id        = id;
  msgDiv.innerHTML = `
    <div class="chat-msg-avatar">✦</div>
    <div class="chat-msg-bubble">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  chatMessages.appendChild(msgDiv);
  scrollChatToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ── Disable/enable send button ──
function setChatLoading(loading) {
  chatSendBtn.disabled = loading;
  document.getElementById("chatBtnText").hidden   = loading;
  document.getElementById("chatBtnLoader").hidden = !loading;
}

// ── Keep chat scrolled to latest message ──
function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── Prevent XSS: escape user-typed text before inserting as HTML ──
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

// ── Auto-resize chat textarea as user types ──
function autoResizeChatInput() {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + "px";
}

chatInput.addEventListener("input", autoResizeChatInput);

// Enter sends, Shift+Enter adds new line
chatInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});


// ════════════════════════════════════════
// SECTION 3 — DOWNLOAD FUNCTIONS
// ════════════════════════════════════════

// ── DOWNLOAD AS REAL PDF (jsPDF) ──
function downloadAsPDF() {
  const text = document.getElementById("summaryText").textContent;
  if (!text) return;

  const pdfBtns = document.querySelectorAll('.btn-download');
  pdfBtns.forEach(b => { if (b.textContent.includes('PDF')) { b.textContent = 'Generating…'; b.disabled = true; } });

  if (window.jspdf) {
    generatePDF(text, pdfBtns);
    return;
  }

  const script   = document.createElement('script');
  script.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  document.head.appendChild(script);
  script.onload  = () => generatePDF(text, pdfBtns);
  script.onerror = () => {
    pdfBtns.forEach(b => { b.textContent = '↓ PDF'; b.disabled = false; });
    alert('Failed to load PDF library. Check your internet connection.');
  };
}

function generatePDF(text, btns) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL    = 20, marginT = 20, marginR = 20;
  const maxWidth   = pageWidth - marginL - marginR;
  let   cursorY    = marginT;

  doc.setFillColor(124, 92, 252);
  doc.rect(0, 0, pageWidth, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('SummarAI', marginL, 9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Smart Text Summarizer', pageWidth - marginR, 9.5, { align: 'right' });

  cursorY = 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 40);
  doc.text('Summary', marginL, cursorY);
  cursorY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 160);
  const dateStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Generated on ${dateStr}`, marginL, cursorY);
  cursorY += 3;

  doc.setDrawColor(220, 220, 235);
  doc.setLineWidth(0.4);
  doc.line(marginL, cursorY + 1, pageWidth - marginR, cursorY + 1);
  cursorY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 50);

  const lines     = text.split('\n').filter(l => l.trim());
  const isBullets = lines.some(l => l.trim().startsWith('•'));

  for (const line of lines) {
    const cleanLine   = line.replace(/^•\s*/, '').trim();
    const blockHeight = 7 * doc.splitTextToSize((isBullets ? '•  ' : '') + cleanLine, maxWidth).length;

    if (cursorY + blockHeight > pageHeight - 20) { doc.addPage(); cursorY = marginT; }

    if (isBullets) {
      doc.setTextColor(124, 92, 252);
      doc.text('•', marginL, cursorY);
      doc.setTextColor(30, 30, 50);
      const wrapped = doc.splitTextToSize(cleanLine, maxWidth - 6);
      doc.text(wrapped, marginL + 6, cursorY);
      cursorY += wrapped.length * 7 + 3;
    } else {
      const wrapped = doc.splitTextToSize(cleanLine, maxWidth);
      doc.text(wrapped, marginL, cursorY);
      cursorY += wrapped.length * 7 + 4;
    }
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 200);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('Generated by SummarAI', marginL, pageHeight - 10);
  }

  doc.save('summary.pdf');
  btns.forEach(b => { b.textContent = '↓ PDF'; b.disabled = false; });
}

// ── DOWNLOAD AS WORD (.docx) ──
function downloadAsWord() {
  const text = document.getElementById("summaryText").textContent;
  if (!text) return;

  const script = document.createElement('script');
  script.src   = 'https://unpkg.com/docx@8.5.0/build/index.umd.js';
  document.head.appendChild(script);

  script.onload = () => {
    const { Document, Paragraph, TextRun, HeadingLevel, Packer } = docx;
    const lines     = text.split('\n').filter(l => l.trim());
    const isBullets = lines.some(l => l.trim().startsWith('•'));

    const contentParagraphs = lines.map(line => {
      const isBullet  = line.trim().startsWith('•');
      const cleanLine = line.replace(/^•\s*/, '').trim();
      return new Paragraph({
        children: [new TextRun({ text: cleanLine, size: 24, font: 'Georgia' })],
        bullet:   isBullet ? { level: 0 } : undefined,
        spacing:  { after: 160 }
      });
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'SummarAI – Summary', heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }),
          new Paragraph({
            children: [new TextRun({
              text: `Generated on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`,
              color: '888888', size: 20
            })],
            spacing: { after: 320 }
          }),
          ...contentParagraphs
        ]
      }]
    });

    Packer.toBlob(doc).then(blob => {
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'summary.docx';
      a.click();
      URL.revokeObjectURL(url);
    });
  };
}

function formatForHTML(text) {
  const lines     = text.split('\n').filter(l => l.trim());
  const isBullets = lines.some(l => l.trim().startsWith('•'));
  if (isBullets) {
    return '<ul>' + lines.map(l => `<li>${l.replace(/^•\s*/, '')}</li>`).join('') + '</ul>';
  }
  return lines.map(l => `<p>${l}</p>`).join('');
}
