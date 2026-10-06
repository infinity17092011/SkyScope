const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 10000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));

// --------------------------------------------------
// Simple in-memory rate limiter
// --------------------------------------------------

const requests = new Map();

const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 1000;

function rateLimit(req, res, next) {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();

  let data = requests.get(ip);

  if (!data || now - data.start > RATE_WINDOW) {
    data = {
      start: now,
      count: 0
    };
  }

  data.count++;

  requests.set(ip, data);

  if (data.count > RATE_LIMIT) {
    return res.status(429).json({
      error: "Too many requests. Please try again shortly."
    });
  }

  next();
}

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "SkyScope",
    astroAI: {
      configured: !!GROQ_API_KEY,
      model: GROQ_MODEL
    }
  });
});

// --------------------------------------------------
// Basic API status
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    name: "SkyScope API",
    status: "online"
  });
});

// --------------------------------------------------
// SkyScope Astro AI
// --------------------------------------------------

app.post("/api/astroai", rateLimit, async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({
        error: "GROQ_API_KEY is not configured on the server."
      });
    }

    const {
      message,
      starSign,
      history
    } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Please provide a message."
      });
    }

    if (!starSign || typeof starSign !== "string") {
      return res.status(400).json({
        error: "Your star sign is required."
      });
    }

    const allowedSigns = [
      "Aries",
      "Taurus",
      "Gemini",
      "Cancer",
      "Leo",
      "Virgo",
      "Libra",
      "Scorpio",
      "Sagittarius",
      "Capricorn",
      "Aquarius",
      "Pisces"
    ];

    const normalizedSign =
      allowedSigns.find(
        sign => sign.toLowerCase() === starSign.trim().toLowerCase()
      );

    if (!normalizedSign) {
      return res.status(400).json({
        error: "Invalid star sign."
      });
    }

    // --------------------------------------------------
    // Build conversation history
    // --------------------------------------------------

    const messages = [
      {
        role: "system",
        content: `
You are SkyScope Astro AI.

SkyScope is a premium astrology knowledge and guidance app.

The user's registered star sign is ${normalizedSign}.

IMPORTANT:
You may ONLY answer questions about the user's registered star sign,
${normalizedSign}, and astrology topics directly connected to that sign.

Do NOT provide personalized astrology information for another star sign.

If the user asks about another sign, politely explain that SkyScope's
Astro AI is currently personalized specifically for their registered
${normalizedSign} sign.

You can discuss:
- ${normalizedSign} personality
- ${normalizedSign} strengths
- ${normalizedSign} challenges
- ${normalizedSign} relationships in an astrology context
- ${normalizedSign} compatibility
- ${normalizedSign} career tendencies
- ${normalizedSign} emotions and communication
- ${normalizedSign} daily, weekly, or general astrology
- planets, houses, elements, modalities, rulers and astrology concepts
  when they are relevant to ${normalizedSign}
- astrology history and symbolism
- birth-chart concepts involving ${normalizedSign}

Do not claim astrology is scientifically proven.
Present astrology as an interpretive or cultural system rather than
established scientific fact.

Do not make medical, legal, financial, or other high-stakes decisions
for the user based on astrology.

Be knowledgeable, specific and useful rather than giving vague generic
horoscope answers.

Do not repeatedly say "as an AI".

Keep answers reasonably concise unless the user asks for more detail.

The user's sign is ${normalizedSign}.
        `.trim()
      }
    ];

    // --------------------------------------------------
    // Add previous conversation
    // --------------------------------------------------

    if (Array.isArray(history)) {
      const safeHistory = history
        .slice(-10)
        .filter(item =>
          item &&
          typeof item === "object" &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
        )
        .map(item => ({
          role: item.role,
          content: item.content.slice(0, 3000)
        }));

      messages.push(...safeHistory);
    }

    messages.push({
      role: "user",
      content: message.trim().slice(0, 4000)
    });

    // --------------------------------------------------
    // Call Groq
    // --------------------------------------------------

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 700
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);

      return res.status(502).json({
        error:
          data?.error?.message ||
          "SkyScope Astro AI could not reach Groq."
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({
        error: "SkyScope Astro AI returned an empty response."
      });
    }

    return res.json({
      reply,
      starSign: normalizedSign,
      model: GROQ_MODEL
    });

  } catch (error) {
    console.error("SkyScope Astro AI error:", error);

    return res.status(500).json({
      error: "SkyScope Astro AI encountered a server error."
    });
  }
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`SkyScope server running on port ${PORT}`);
  console.log(
    `Groq configured: ${GROQ_API_KEY ? "YES" : "NO"}`
  );
  console.log(`Groq model: ${GROQ_MODEL}`);
});