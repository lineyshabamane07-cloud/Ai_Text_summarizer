// ═══════════════════════════════════════════════════════════
// ADD THIS ROUTE TO YOUR EXISTING server.js
// Paste it right after your existing /api/summarize route
// ═══════════════════════════════════════════════════════════

app.post('/api/chat', async (req, res) => {
  try {
    const { system, messages } = req.body;

    // messages = full conversation history sent from the browser
    // system   = context prompt containing original text + summary

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'sk-ant-YOUR_KEY_HERE',   // ← same key as your summarize route
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: system,        // context: original text + summary
        messages: messages     // full chat history = memory
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API error' });
    }

    const reply = data.content?.[0]?.text || '';
    res.json({ reply });

  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ error: err.message });
  }
});
