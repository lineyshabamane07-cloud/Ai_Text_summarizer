export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, style } = req.body;

  if (!text || text.length < 50) {
    return res.status(400).json({
      error: "Text must be at least 50 characters."
    });
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a professional text summarizer."
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    }
  );

  const data = await response.json();

  return res.status(200).json({
    summary: data.choices?.[0]?.message?.content || ""
  });
}
