
require("dotenv").config();

const express  = require("express");   // Web server framework
const path     = require("path");      // Helps build file paths (built into Node)

// node-fetch lets us call the Groq API from Node.js
// Note: we use dynamic import because node-fetch v3 is ESM-only
let fetch;
(async () => { fetch = (await import("node-fetch")).default; })();


// ─────────────────────────────────────────
// STEP 2 ▸ App Setup
// ─────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT || 3000;  // Use env PORT for hosting, or 3000 locally

// Parse incoming JSON request bodies
app.use(express.json());

// Serve your static files (index.html, style.css, app.js)
// from the same folder as this server.js
app.use(express.static(path.join(__dirname)));


// ─────────────────────────────────────────
// STEP 3 ▸ Groq Config (server-side only)
// Your API key lives here — never sent to browser
// ─────────────────────────────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY;  // Read from .env file
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";


// ─────────────────────────────────────────
// STEP 4 ▸ Build the AI Prompt
// Same logic as in app.js, but now runs
// safely on the server side
// ─────────────────────────────────────────

function buildMessages(text, style) {

  const systemMessage =
    "You are a professional text summarizer. " +
    "Always respond with only the summary — no preamble, no explanations, " +
    "no phrases like 'Here is a summary'. Just the summary itself.";

  const styleInstructions = {
    short:
      "Summarize the following text in 2 to 3 clear, concise sentences. " +
      "Capture only the most essential idea.",

    medium:
      "Write a medium-length summary (one solid paragraph, around 5–8 sentences) " +
      "of the following text. Cover the main points and key details.",

    bullets:
      "Summarize the following text as a bullet point list. " +
      "Start each bullet with '• '. Include 4 to 7 key takeaways. " +
      "Each bullet should be one sentence.",
  };

  // Default to 'short' if an unknown style is sent
  const instruction = styleInstructions[style] || styleInstructions.short;

  return [
    { role: "system", content: systemMessage },
    { role: "user",   content: `${instruction}\n\nText to summarize:\n"""\n${text}\n"""` },
  ];
}


// ─────────────────────────────────────────
// STEP 5 ▸ /api/summarize  (POST)
// This is the only route your frontend calls.
// It receives text + style, calls Groq,
// and returns the summary.
// ─────────────────────────────────────────

app.post("/api/summarize", async (req, res) => {

  // --- 5a. Check API key is configured ---
  if (!GROQ_API_KEY) {
    return res.status(500).json({
      error: "Server is missing GROQ_API_KEY. Add it to your .env file.",
    });
  }

  // --- 5b. Read body sent from the browser ---
  const { text, style } = req.body;

  // --- 5c. Validate inputs ---
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'text' field." });
  }

  if (text.trim().length < 50) {
    return res.status(400).json({ error: "Text is too short. Send at least 50 characters." });
  }

  const validStyles = ["short", "medium", "bullets"];
  if (style && !validStyles.includes(style)) {
    return res.status(400).json({ error: `Invalid style. Choose: ${validStyles.join(", ")}.` });
  }

  // --- 5d. Call Groq API ---
  try {
    const groqResponse = await fetch(GROQ_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + GROQ_API_KEY,  // Key stays on server! 🔒
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        max_tokens:  1024,
        temperature: 0.4,
        messages:    buildMessages(text.trim(), style || "short"),
      }),
    });

    // --- 5e. Handle Groq errors ---
    if (!groqResponse.ok) {
      const errData = await groqResponse.json().catch(() => ({}));
      const errMsg  = errData.error?.message || "Groq API error";

      console.error(`[Groq Error] ${groqResponse.status}: ${errMsg}`);

      if (groqResponse.status === 401) {
        return res.status(401).json({ error: "Invalid Groq API key on server." });
      } else if (groqResponse.status === 429) {
        return res.status(429).json({ error: "Rate limit reached. Please wait and try again." });
      } else {
        return res.status(502).json({ error: `Groq error: ${errMsg}` });
      }
    }

    // --- 5f. Parse and return the summary ---
    const data    = await groqResponse.json();
    const summary = data.choices[0].message.content.trim();

    // Send summary back to the browser
    return res.json({ summary });

  } catch (err) {
    // Network error or unexpected crash
    console.error("[Server Error]", err.message);
    return res.status(500).json({ error: "Internal server error. Check the terminal for details." });
  }
});


// ─────────────────────────────────────────
// STEP 6 ▸ Catch-all route
// Sends index.html for any unknown URL
// (important when you have multiple pages)
// ─────────────────────────────────────────

app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// ─────────────────────────────────────────
// STEP 7 ▸ Start the server
// ─────────────────────────────────────────

app.listen(PORT, () => {
  console.log("─────────────────────────────────────");
  console.log(`  ✦ SummarAI server is running!`);
  console.log(`  → Local:   http://localhost:${PORT}`);
  console.log(`  → API key: ${GROQ_API_KEY ? "✅ loaded from .env" : "❌ MISSING — add to .env"}`);
  console.log("─────────────────────────────────────");
});
