export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { system, messages } = req.body;

    // Build messages array the way Groq expects it:
    // system message first, then the conversation history
    const groqMessages = [
      { role: 'system', content: system },
      ...messages
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',   // same model your summarize.js likely uses
        max_tokens: 1024,
        messages: groqMessages
      })
    });

    // Read raw text first — helps debug if Groq sends back an unexpected response
    const rawText = await response.text();

    // Guard against empty response body
    if (!rawText || rawText.trim() === '') {
      return res.status(500).json({ error: 'Empty response from Groq API' });
    }

    // Now safely parse
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Groq raw response:', rawText);
      return res.status(500).json({ error: 'Invalid JSON from Groq: ' + rawText.slice(0, 200) });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Groq API error' });
    }

    const reply = data.choices?.[0]?.message?.content || '';

    if (!reply) {
      return res.status(500).json({ error: 'No reply content in Groq response' });
    }

    res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat handler error:', err);
    res.status(500).json({ error: err.message });
  }
}
