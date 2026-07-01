export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, style } = req.body;

  const instructions = {
    short:
      "Summarize the following text in 2–3 concise sentences.",

    medium:
      "Summarize the following text in one paragraph (5–8 sentences).",

    bullets:
      "Summarize the following text as bullet points. Start every bullet with '• '. Include 4 to 7 bullet points."
  };

  if (!text || text.length < 50) {
    return res.status(400).json({
      error: "Text must be at least 50 characters."
    });
  }

  try {
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
              content:
                "You are a professional text summarizer. Respond only with the summary."
            },
            {
              role: "user",
              content:
                (instructions[style] || instructions.short) +
                "\n\nText:\n" +
                text
            }
          ]
        })
      }
    );

    const data = await response.json();

    return res.status(200).json({
      summary: data.choices?.[0]?.message?.content || ""
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "A server error occurred."
    });
  }
}
