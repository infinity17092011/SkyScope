const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("WARNING: Supabase environment variables are missing.");
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// --------------------------------------------------
// STAR SIGNS
// --------------------------------------------------

const SIGNS = {
  aries: {
    name: "Aries",
    symbol: "♈",
    dates: "March 21 – April 19"
  },
  taurus: {
    name: "Taurus",
    symbol: "♉",
    dates: "April 20 – May 20"
  },
  gemini: {
    name: "Gemini",
    symbol: "♊",
    dates: "May 21 – June 20"
  },
  cancer: {
    name: "Cancer",
    symbol: "♋",
    dates: "June 21 – July 22"
  },
  leo: {
    name: "Leo",
    symbol: "♌",
    dates: "July 23 – August 22"
  },
  virgo: {
    name: "Virgo",
    symbol: "♍",
    dates: "August 23 – September 22"
  },
  libra: {
    name: "Libra",
    symbol: "♎",
    dates: "September 23 – October 22"
  },
  scorpio: {
    name: "Scorpio",
    symbol: "♏",
    dates: "October 23 – November 21"
  },
  sagittarius: {
    name: "Sagittarius",
    symbol: "♐",
    dates: "November 22 – December 21"
  },
  capricorn: {
    name: "Capricorn",
    symbol: "♑",
    dates: "December 22 – January 19"
  },
  aquarius: {
    name: "Aquarius",
    symbol: "♒",
    dates: "January 20 – February 18"
  },
  pisces: {
    name: "Pisces",
    symbol: "♓",
    dates: "February 19 – March 20"
  }
};

// --------------------------------------------------
// DAILY CONTENT
// --------------------------------------------------

const moods = [
  {
    mood: "Magnetic",
    text: "Your energy is drawing attention today. Trust your instincts and let yourself be noticed."
  },
  {
    mood: "Focused",
    text: "Today favors concentration. One clear goal could matter more than trying to do everything."
  },
  {
    mood: "Curious",
    text: "Something unexpected may catch your attention today. Follow the curiosity."
  },
  {
    mood: "Reflective",
    text: "Slow down enough to notice what your instincts have been telling you."
  },
  {
    mood: "Bold",
    text: "Your confidence has room to grow today. Take the step you've been considering."
  },
  {
    mood: "Social",
    text: "Connections are highlighted today. A simple conversation could shift your mood."
  },
  {
    mood: "Calm",
    text: "Today's energy is better suited to steady progress than rushing."
  }
];

const dailySections = [
  "Your energy is shifting toward something new.",
  "Someone around you may notice a side of you they haven't seen before.",
  "A small decision today could influence the tone of the next few days.",
  "Trust your first instinct, but give yourself time before making a major decision.",
  "Your attention may be pulled in several directions. Choose what actually matters.",
  "There is value in letting something develop naturally instead of forcing it.",
  "Today is a good day to notice patterns in the way you react to people and situations."
];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function hashString(value) {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getDailyContent(sign) {
  const today = getToday();
  const seed = hashString(`${sign}-${today}`);

  const mood = moods[seed % moods.length];
  const section1 = dailySections[seed % dailySections.length];
  const section2 = dailySections[(seed + 2) % dailySections.length];
  const section3 = dailySections[(seed + 4) % dailySections.length];

  return {
    date: today,
    sign,
    mood: mood.mood,
    mood_text: mood.text,
    cosmic_energy: `${50 + (seed % 50)}%`,
    insight: section1,
    relationships: section2,
    guidance: section3
  };
}

// --------------------------------------------------
// QUIZ QUESTIONS
// --------------------------------------------------

const quizQuestions = [
  {
    question: "Which element is traditionally associated with this sign?",
    options: ["Fire", "Earth", "Air", "Water"],
    answers: {
      aries: 0,
      leo: 0,
      sagittarius: 0,
      taurus: 1,
      virgo: 1,
      capricorn: 1,
      gemini: 2,
      libra: 2,
      aquarius: 2,
      cancer: 3,
      scorpio: 3,
      pisces: 3
    }
  },
  {
    question: "Which quality best matches this sign?",
    options: ["Initiative", "Stability", "Curiosity", "Sensitivity"],
    answers: {
      aries: 0,
      leo: 0,
      sagittarius: 0,
      taurus: 1,
      virgo: 1,
      capricorn: 1,
      gemini: 2,
      libra: 2,
      aquarius: 2,
      cancer: 3,
      scorpio: 3,
      pisces: 3
    }
  },
  {
    question: "What is the zodiac symbol for this sign?",
    options: ["♈", "♌", "♎", "♓"],
    answers: {
      aries: 0,
      leo: 1,
      libra: 2,
      pisces: 3
    }
  },
  {
    question: "How many signs are in the zodiac?",
    options: ["10", "11", "12", "13"],
    answers: {
      aries: 2,
      taurus: 2,
      gemini: 2,
      cancer: 2,
      leo: 2,
      virgo: 2,
      libra: 2,
      scorpio: 2,
      sagittarius: 2,
      capricorn: 2,
      aquarius: 2,
      pisces: 2
    }
  },
  {
    question: "What is today's reading based on?",
    options: [
      "Your selected sign and the current date",
      "Your phone battery",
      "Your location only",
      "A random result every second"
    ],
    answers: {
      aries: 0,
      taurus: 0,
      gemini: 0,
      cancer: 0,
      leo: 0,
      virgo: 0,
      libra: 0,
      scorpio: 0,
      sagittarius: 0,
      capricorn: 0,
      aquarius: 0,
      pisces: 0
    }
  }
];

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

function validSign(sign) {
  return typeof sign === "string" && !!SIGNS[sign.toLowerCase()];
}

function cleanEmail(email) {
  return typeof email === "string"
    ? email.trim().toLowerCase()
    : "";
}

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    name: "Skyscope API",
    status: "online",
    demo: true,
    payments: false,
    date: getToday()
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "skyscope-backend",
    supabase: !!supabase,
    payments: false,
    date: getToday()
  });
});

// --------------------------------------------------
// SIGNS
// --------------------------------------------------

app.get("/api/signs", (req, res) => {
  res.json(SIGNS);
});

// --------------------------------------------------
// SIGNUP
// --------------------------------------------------

app.post("/api/signup", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const sign = String(req.body.star_sign || "").toLowerCase();

    if (!email) {
      return res.status(400).json({
        error: "Email is required."
      });
    }

    if (!validSign(sign)) {
      return res.status(400).json({
        error: "A valid star sign is required."
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: "Supabase is not configured on the server."
      });
    }

    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          email,
          star_sign: sign,
          plan: "premium_demo",
          subscription_status: "demo"
        },
        {
          onConflict: "email"
        }
      )
      .select()
      .single();

    if (error) {
      console.error(error);

      return res.status(500).json({
        error: "Could not save your Skyscope profile.",
        details: error.message
      });
    }

    res.json({
      success: true,
      user: data,
      demo: true
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Signup failed."
    });
  }
});

// --------------------------------------------------
// PROFILE
// --------------------------------------------------

app.get("/api/profile", async (req, res) => {
  try {
    const email = cleanEmail(req.query.email);

    if (!email) {
      return res.status(400).json({
        error: "Email is required."
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: "Supabase is not configured."
      });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    res.json({
      success: true,
      user: data
    });
  } catch (error) {
    res.status(500).json({
      error: "Could not load profile."
    });
  }
});

// --------------------------------------------------
// DAILY MOOD
// --------------------------------------------------

app.get("/api/mood", (req, res) => {
  const sign = String(req.query.sign || "").toLowerCase();

  if (!validSign(sign)) {
    return res.status(400).json({
      error: "Valid star sign required."
    });
  }

  const content = getDailyContent(sign);

  res.json({
    success: true,
    content
  });
});

// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get("/api/home", async (req, res) => {
  try {
    const email = cleanEmail(req.query.email);

    if (!email) {
      return res.status(400).json({
        error: "Email is required."
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: "Supabase is not configured."
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: error.message
      });
    }

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    const sign = user.star_sign;
    const content = getDailyContent(sign);

    res.json({
      success: true,
      user: {
        email: user.email,
        star_sign: sign,
        plan: user.plan,
        subscription_status: user.subscription_status
      },
      today: content,
      premium_demo: {
        notifications: true,
        quiz: true,
        streak: true
      }
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not load Skyscope."
    });
  }
});

// --------------------------------------------------
// NOTIFICATIONS
// --------------------------------------------------

app.get("/api/notifications", async (req, res) => {
  const sign = String(req.query.sign || "").toLowerCase();

  if (!validSign(sign)) {
    return res.status(400).json({
      error: "Valid star sign required."
    });
  }

  const seed = hashString(`${sign}-${getToday()}-notification`);

  const notifications = [
    `Your ${SIGNS[sign].name} energy is shifting today.`,
    `A new ${SIGNS[sign].name} reading is ready.`,
    `Your cosmic forecast has something to say today.`,
    `Today's ${SIGNS[sign].name} energy is worth checking out.`
  ];

  res.json({
    success: true,
    notifications: [
      {
        title: "Skyscope",
        message: notifications[seed % notifications.length],
        date: getToday()
      }
    ]
  });
});

// --------------------------------------------------
// QUIZ
// --------------------------------------------------

app.get("/api/quiz", (req, res) => {
  const sign = String(req.query.sign || "").toLowerCase();

  if (!validSign(sign)) {
    return res.status(400).json({
      error: "Valid star sign required."
    });
  }

  const questions = quizQuestions.map((q, index) => {
    const correctAnswer =
      q.answers[sign] !== undefined
        ? q.answers[sign]
        : 0;

    return {
      id: index + 1,
      question: q.question,
      options: q.options,
      correct_answer: correctAnswer
    };
  });

  res.json({
    success: true,
    date: getToday(),
    sign,
    questions
  });
});

// --------------------------------------------------
// QUIZ SUBMISSION + STREAK
// --------------------------------------------------

app.post("/api/quiz/submit", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const sign = String(req.body.star_sign || "").toLowerCase();
    const answers = req.body.answers;

    if (!email || !validSign(sign) || !Array.isArray(answers)) {
      return res.status(400).json({
        error: "Email, star sign and answers are required."
      });
    }

    if (answers.length !== 5) {
      return res.status(400).json({
        error: "The daily quiz requires exactly 5 answers."
      });
    }

    let score = 0;

    quizQuestions.forEach((question, index) => {
      const correct =
        question.answers[sign] !== undefined
          ? question.answers[sign]
          : 0;

      if (Number(answers[index]) === correct) {
        score++;
      }
    });

    if (!supabase) {
      return res.status(500).json({
        error: "Supabase is not configured."
      });
    }

    const today = getToday();

    // Find previous quiz result.
    const { data: previousResults, error: previousError } =
      await supabase
        .from("quiz_results")
        .select("*")
        .eq("email", email)
        .order("quiz_date", { ascending: false })
        .limit(2);

    if (previousError) {
      return res.status(500).json({
        error: previousError.message
      });
    }

    let streak = 1;

    if (previousResults && previousResults.length > 0) {
      const previous = previousResults[0];

      if (previous.quiz_date === today) {
        streak = previous.streak || 1;
      } else {
        const yesterday = new Date();

        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayString = yesterday
          .toISOString()
          .slice(0, 10);

        if (previous.quiz_date === yesterdayString) {
          streak = (previous.streak || 0) + 1;
        }
      }
    }

    const { data: result, error: insertError } = await supabase
      .from("quiz_results")
      .insert({
        email,
        star_sign: sign,
        quiz_date: today,
        score,
        total_questions: 5,
        streak
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({
        error: insertError.message
      });
    }

    res.json({
      success: true,
      result: {
        score,
        total: 5,
        percentage: Math.round((score / 5) * 100),
        streak,
        date: today
      },
      saved: true
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Quiz submission failed."
    });
  }
});

// --------------------------------------------------
// STREAK
// --------------------------------------------------

app.get("/api/streak", async (req, res) => {
  try {
    const email = cleanEmail(req.query.email);

    if (!email) {
      return res.status(400).json({
        error: "Email is required."
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: "Supabase is not configured."
      });
    }

    const { data, error } = await supabase
      .from("quiz_results")
      .select("quiz_date, score, streak")
      .eq("email", email)
      .order("quiz_date", { ascending: false })
      .limit(1);

    if (error) {
      return res.status(500).json({
        error: error.message
      });
    }

    if (!data || data.length === 0) {
      return res.json({
        success: true,
        streak: 0,
        last_quiz: null
      });
    }

    res.json({
      success: true,
      streak: data[0].streak || 0,
      last_quiz: data[0]
    });
  } catch (error) {
    res.status(500).json({
      error: "Could not load streak."
    });
  }
});

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found."
  });
});

// --------------------------------------------------
// START
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Skyscope backend running on port ${PORT}`);
  console.log("Payments: disabled");
  console.log(`Supabase configured: ${!!supabase}`);
});