/* ════════════════════════════════════════
   SummarAI – app.js  (Groq Edition - FIXED)
   ════════════════════════════════════════ */

// ── CONFIG ──
const API_URL = "/api/summarize";

// ── CHARACTER COUNTER ──
const inputTextEl = document.getElementById("inputText");
const charCountEl = document.getElementById("charCount");
// Upload Elements
const documentInput = document.getElementById("documentInput");
const fileName = document.getElementById("fileName");

inputTextEl.addEventListener("input", function () {
  charCountEl.textContent = inputTextEl.value.length;
});
// Upload Listener
if (documentInput) {
  documentInput.addEventListener("change", uploadDocument);
}

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

    if(documentInput){

        documentInput.value = "";

    }

    if(fileName){

        fileName.textContent = "No file selected";

    }

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
// ── DOWNLOAD AS REAL PDF (jsPDF) ──
function downloadAsPDF() {
  const text = document.getElementById("summaryText").textContent;
  if (!text) return;

  // Show a brief loading state on the button
  const pdfBtn = document.querySelector('.btn-download');
  pdfBtn.textContent = 'Generating…';
  pdfBtn.disabled = true;

  // Load jsPDF from CDN if not already loaded
  if (window.jspdf) {
    generatePDF(text, pdfBtn);
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  document.head.appendChild(script);

  script.onload = () => generatePDF(text, pdfBtn);

  script.onerror = () => {
    pdfBtn.textContent = '↓ PDF';
    pdfBtn.disabled = false;
    alert('Failed to load PDF library. Check your internet connection.');
  };
}

function generatePDF(text, btn) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth   = doc.internal.pageSize.getWidth();
  const pageHeight  = doc.internal.pageSize.getHeight();
  const marginLeft  = 20;
  const marginTop   = 20;
  const marginRight = 20;
  const maxWidth    = pageWidth - marginLeft - marginRight;
  let cursorY       = marginTop;

  // ── Header bar ──
  doc.setFillColor(124, 92, 252);           // violet accent
  doc.rect(0, 0, pageWidth, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('SummarAI', marginLeft, 9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Smart Text Summarizer', pageWidth - marginRight, 9.5, { align: 'right' });

  cursorY = 28;

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 40);
  doc.text('Summary', marginLeft, cursorY);
  cursorY += 7;

  // ── Date line ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 160);
  const dateStr = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  doc.text(`Generated on ${dateStr}`, marginLeft, cursorY);
  cursorY += 3;

  // ── Divider ──
  doc.setDrawColor(220, 220, 235);
  doc.setLineWidth(0.4);
  doc.line(marginLeft, cursorY + 1, pageWidth - marginRight, cursorY + 1);
  cursorY += 10;

  // ── Body text ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 50);

  const lines = text.split('\n').filter(l => l.trim());
  const isBullets = lines.some(l => l.trim().startsWith('•'));

  for (const line of lines) {
    const cleanLine = line.replace(/^•\s*/, '').trim();
    const prefix    = isBullets ? '•  ' : '';

    // Word-wrap the line to fit page width
    const wrapped = doc.splitTextToSize(prefix + cleanLine, maxWidth);

    // Check if we need a new page
    const blockHeight = wrapped.length * 7;
    if (cursorY + blockHeight > pageHeight - 20) {
      doc.addPage();
      cursorY = marginTop;
    }

    // Draw bullet dot in accent color
    if (isBullets) {
      doc.setTextColor(124, 92, 252);
      doc.text('•', marginLeft, cursorY);
      doc.setTextColor(30, 30, 50);
      // Indent the text after the bullet
      const indentedLines = doc.splitTextToSize(cleanLine, maxWidth - 6);
      doc.text(indentedLines, marginLeft + 6, cursorY);
      cursorY += indentedLines.length * 7 + 3;
    } else {
      doc.text(wrapped, marginLeft, cursorY);
      cursorY += wrapped.length * 7 + 4;
    }
  }

  // ── Footer on every page ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 200);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text('Generated by SummarAI', marginLeft, pageHeight - 10);
  }

  // ── Save ──
  doc.save('summary.pdf');

  // Reset button
  btn.textContent = '↓ PDF';
  btn.disabled = false;
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
async function uploadDocument(event) {

    const file = event.target.files[0];

    if (!file) return;

    fileName.textContent = file.name;

    const extension = file.name.split(".").pop().toLowerCase();

    try {

        if (extension === "txt") {

            await readTXT(file);

        }

        else if (extension === "pdf") {

            await readPDF(file);

        }

        else if (extension === "docx") {

            await readDOCX(file);

        }

        else {

            alert("Unsupported file.");

        }

    }

    catch (error) {

        console.error(error);

        alert("Unable to read this document.");

    }

}
async function readTXT(file) {

    const text = await file.text();

    inputTextEl.value = text;

    charCountEl.textContent = text.length;

}
async function readDOCX(file) {

    if (!window.mammoth) {

        throw new Error("Mammoth library missing.");

    }

    const buffer = await file.arrayBuffer();

    const result = await mammoth.extractRawText({

        arrayBuffer: buffer

    });

    inputTextEl.value = result.value;

    charCountEl.textContent = result.value.length;

}
async function readPDF(file) {

    if (!window.pdfjsLib) {

        throw new Error("PDF.js library missing.");

    }

    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({

        data: buffer

    }).promise;

    let text = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {

        const page = await pdf.getPage(pageNumber);

        const content = await page.getTextContent();

        const pageText = content.items.map(item => item.str).join(" ");

        text += pageText + "\n";

    }

    inputTextEl.value = text;

    charCountEl.textContent = text.length;

}
