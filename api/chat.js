export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`  // same env variable you already have
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that answers questions about a text summary. ' +
              'Be concise and accurate. Only answer based on what the summary says. ' +
              'If asked something not in the summary, say so honestly.'
          },
          ...messages
        ],
        max_tokens: 512,
        temperature: 0.5
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq API error');

    const reply = data.choices[0].message.content.trim();
    res.status(200).json({ reply });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
