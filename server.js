"use strict";

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { promisify } = require("util");
const { createClient } = require("@supabase/supabase-js");

const scrypt = promisify(crypto.scrypt);
const app = express();
app.set("trust proxy", 1);
app.use(cors());

/* ------------------------------------------------------------------ */
/* CONFIG                                                              */
/* ------------------------------------------------------------------ */

const PORT = process.env.PORT || 10000;
const {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET,
  PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_PLAN_ID
} = process.env;

const SESSION_DAYS = 30;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const authReady = () => !!supabase && !!SESSION_SECRET && SESSION_SECRET.length >= 32;
const paypalReady = () => !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET && PAYPAL_PLAN_ID);

if (!supabase) console.warn("WARNING: Supabase variables are missing.");
if (!SESSION_SECRET || SESSION_SECRET.length < 32) console.warn("WARNING: SESSION_SECRET missing or under 32 characters.");

/* ------------------------------------------------------------------ */
/* SIGN DATA                                                           */
/* ------------------------------------------------------------------ */

const SIGNS = {
  aries:       { name: "Aries",       symbol: "♈", dates: "March 21 – April 19",       element: "Fire",  modality: "Cardinal", planet: "Mars",    emblem: "Ram" },
  taurus:      { name: "Taurus",      symbol: "♉", dates: "April 20 – May 20",         element: "Earth", modality: "Fixed",    planet: "Venus",   emblem: "Bull" },
  gemini:      { name: "Gemini",      symbol: "♊", dates: "May 21 – June 20",          element: "Air",   modality: "Mutable",  planet: "Mercury", emblem: "Twins" },
  cancer:      { name: "Cancer",      symbol: "♋", dates: "June 21 – July 22",         element: "Water", modality: "Cardinal", planet: "Moon",    emblem: "Crab" },
  leo:         { name: "Leo",         symbol: "♌", dates: "July 23 – August 22",       element: "Fire",  modality: "Fixed",    planet: "Sun",     emblem: "Lion" },
  virgo:       { name: "Virgo",       symbol: "♍", dates: "August 23 – September 22",  element: "Earth", modality: "Mutable",  planet: "Mercury", emblem: "Maiden" },
  libra:       { name: "Libra",       symbol: "♎", dates: "September 23 – October 22", element: "Air",   modality: "Cardinal", planet: "Venus",   emblem: "Scales" },
  scorpio:     { name: "Scorpio",     symbol: "♏", dates: "October 23 – November 21",  element: "Water", modality: "Fixed",    planet: "Pluto",   emblem: "Scorpion" },
  sagittarius: { name: "Sagittarius", symbol: "♐", dates: "November 22 – December 21", element: "Fire",  modality: "Mutable",  planet: "Jupiter", emblem: "Archer" },
  capricorn:   { name: "Capricorn",   symbol: "♑", dates: "December 22 – January 19",  element: "Earth", modality: "Cardinal", planet: "Saturn",  emblem: "Sea-goat" },
  aquarius:    { name: "Aquarius",    symbol: "♒", dates: "January 20 – February 18",  element: "Air",   modality: "Fixed",    planet: "Uranus",  emblem: "Water bearer" },
  pisces:      { name: "Pisces",      symbol: "♓", dates: "February 19 – March 20",    element: "Water", modality: "Mutable",  planet: "Neptune", emblem: "Fish" }
};
const KEYS = Object.keys(SIGNS);
const ALL = KEYS.map((k) => SIGNS[k]);
const NAMES = ALL.map((s) => s.name);
const SYMBOLS = ALL.map((s) => s.symbol);
const DATES = ALL.map((s) => s.dates);
const PLANETS = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

const getToday = () => new Date().toISOString().slice(0, 10);
const shiftDay = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function hashString(value) {
  let h = 0;
  for (let i = 0; i < value.length; i++) { h = (h << 5) - h + value.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const cleanEmail = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const validEmail = (v) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validUsername = (v) => /^[A-Za-z0-9_]{3,20}$/.test(v);

/* ------------------------------------------------------------------ */
/* DAILY READING AND MOOD                                              */
/* ------------------------------------------------------------------ */

const moods = [
  { mood: "Magnetic",   text: "Your energy is drawing attention today. Trust your instincts and let yourself be noticed." },
  { mood: "Focused",    text: "Today favors concentration. One clear goal could matter more than trying to do everything." },
  { mood: "Curious",    text: "Something unexpected may catch your attention today. Follow the curiosity." },
  { mood: "Reflective", text: "Slow down enough to notice what your instincts have been telling you." },
  { mood: "Bold",       text: "Your confidence has room to grow today. Take the step you've been considering." },
  { mood: "Social",     text: "Connections are highlighted today. A simple conversation could shift your mood." },
  { mood: "Calm",       text: "Today's energy is better suited to steady progress than rushing." }
];

const sections = [
  "Your energy is shifting toward something new.",
  "Someone around you may notice a side of you they haven't seen before.",
  "A small decision today could influence the tone of the next few days.",
  "Trust your first instinct, but give yourself time before making a major decision.",
  "Your attention may be pulled in several directions. Choose what actually matters.",
  "There is value in letting something develop naturally instead of forcing it.",
  "Today is a good day to notice patterns in the way you react to people and situations."
];

function getDailyContent(sign, date = getToday()) {
  const seed = hashString(`${sign}-${date}`);
  const m = moods[seed % moods.length];
  return {
    date, sign, mood: m.mood, mood_text: m.text,
    cosmic_energy: 50 + (seed % 50),
    insight: sections[seed % sections.length],
    relationships: sections[(seed + 2) % sections.length],
    guidance: sections[(seed + 4) % sections.length]
  };
}

function premiumExtras(sign, date = getToday()) {
  const seed = hashString(`${sign}-${date}-premium`);
  const colors = ["Amber", "Teal", "Violet", "Crimson", "Silver", "Emerald", "Indigo"];
  const times = ["Early morning", "Late morning", "Afternoon", "Evening", "Late night"];
  return {
    lucky_number: 1 + (seed % 99),
    lucky_color: colors[seed % colors.length],
    best_time: times[(seed >> 3) % times.length],
    compatible_sign: NAMES[(seed >> 5) % NAMES.length],
    deep_read: sections[(seed + 3) % sections.length] + " " + sections[(seed + 5) % sections.length]
  };
}

/* ------------------------------------------------------------------ */
/* DAILY QUIZ: same 5 questions for everyone each day, new every day   */
/* ------------------------------------------------------------------ */

const templates = [
  (s) => ({ q: `Which element is ${s.name}?`, a: s.element, pool: ["Fire", "Earth", "Air", "Water"] }),
  (s) => ({ q: `Which modality does ${s.name} belong to?`, a: s.modality, pool: ["Cardinal", "Fixed", "Mutable"] }),
  (s) => ({ q: `Which symbol represents ${s.name}?`, a: s.symbol, pool: SYMBOLS }),
  (s) => ({ q: `Which dates fall under ${s.name}?`, a: s.dates, pool: DATES }),
  (s) => ({ q: `Which planet is the modern ruler of ${s.name}?`, a: s.planet, pool: PLANETS }),
  (s) => ({ q: `Which sign is represented by the ${s.emblem}?`, a: s.name, pool: NAMES }),
  (s, i) => ({ q: `Which sign comes right after ${s.name} in the zodiac?`, a: SIGNS[KEYS[(i + 1) % 12]].name, pool: NAMES }),
  (s, i) => ({ q: `Which sign sits opposite ${s.name} on the zodiac wheel?`, a: SIGNS[KEYS[(i + 6) % 12]].name, pool: NAMES }),
  (s) => ({ q: `Which of these is a ${s.element} sign?`, a: s.name, pool: ALL.filter((x) => x.element !== s.element).map((x) => x.name) })
];

const trivia = [
  { q: "Which planet is closest to the Sun?", a: "Mercury", pool: ["Mercury", "Venus", "Earth", "Mars"] },
  { q: "Which planet is the largest in our solar system?", a: "Jupiter", pool: ["Jupiter", "Saturn", "Neptune", "Earth"] },
  { q: "Which planet is known as the Red Planet?", a: "Mars", pool: ["Mars", "Venus", "Mercury", "Jupiter"] },
  { q: "How many signs are in the zodiac?", a: "12", pool: ["10", "11", "12", "13", "14"] },
  { q: "About how long is one lunar cycle?", a: "About 29 days", pool: ["About 7 days", "About 14 days", "About 29 days", "About 365 days"] },
  { q: "Which sign is traditionally ruled by the Sun?", a: "Leo", pool: NAMES }
];

function buildQuiz(date) {
  const rand = seededRandom(hashString(`quiz-${date}`));
  const slots = shuffle([...Array(templates.length + trivia.length).keys()], rand).slice(0, 5);

  return slots.map((slot) => {
    let item;
    if (slot < templates.length) {
      const i = Math.floor(rand() * 12);
      item = templates[slot](SIGNS[KEYS[i]], i);
    } else {
      item = trivia[slot - templates.length];
    }
    const wrong = shuffle(item.pool.filter((x) => x !== item.a), rand).slice(0, 3);
    const options = shuffle([item.a, ...wrong], rand);
    return { question: item.q, options, correct: options.indexOf(item.a) };
  });
}

/* ------------------------------------------------------------------ */
/* PASSWORDS, TOKENS, RATE LIMITS                                      */
/* ------------------------------------------------------------------ */

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

async function checkPassword(password, stored) {
  const [saltHex, keyHex] = String(stored || "").split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function signToken(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_DAYS * 86400000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!SESSION_SECRET || typeof token !== "string" || token.length > 2000) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.email && typeof data.exp === "number" && data.exp > Date.now() ? data : null;
  } catch { return null; }
}

const attempts = new Map();
function tooMany(key, max, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  const blocked = recent.length >= max;
  if (!blocked) recent.push(now);
  attempts.set(key, recent);
  return blocked;
}
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, list] of attempts) {
    const recent = list.filter((t) => t > cutoff);
    if (recent.length) attempts.set(k, recent); else attempts.delete(k);
  }
}, 5 * 60 * 1000).unref();

async function userFromRequest(req) {
  const header = req.headers.authorization || "";
  const payload = verifyToken(header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!payload) return null;
  const { data, error } = await supabase.from("users").select("*").eq("email", payload.email).maybeSingle();
  if (error) throw error;
  return data;
}

async function requireAuth(req, res, next) {
  try {
    if (!authReady()) return res.status(500).json({ error: "The server isn't fully configured yet." });
    const user = await userFromRequest(req);
    if (!user) return res.status(401).json({ error: "Your session has expired. Sign in again." });
    req.user = user;
    next();
  } catch (err) { next(err); }
}

/* ------------------------------------------------------------------ */
/* DATA HELPERS                                                        */
/* ------------------------------------------------------------------ */

async function getStreak(email) {
  const { data, error } = await supabase.from("quiz_results").select("quiz_date, streak")
    .eq("email", email).order("quiz_date", { ascending: false }).limit(1);
  if (error || !data || !data.length) return 0;
  const today = getToday();
  const last = data[0];
  return last.quiz_date === today || last.quiz_date === shiftDay(today, -1) ? last.streak || 0 : 0;
}

const isPremium = (user) => user.plan === "premium";

async function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    star_sign: user.star_sign,
    plan: isPremium(user) ? "premium" : "free",
    is_premium: isPremium(user),
    streak: await getStreak(user.email)
  };
}

function formatResult(row) {
  const total = row.total_questions || 5;
  return {
    score: row.score, total, points: row.score,
    percentage: Math.round((row.score / total) * 100),
    streak: row.streak || 1, date: row.quiz_date
  };
}

async function findResult(email, date) {
  const { data, error } = await supabase.from("quiz_results").select("*").eq("email", email).eq("quiz_date", date).maybeSingle();
  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------ */
/* PAYPAL SUBSCRIPTIONS (plain HTTPS, no extra package, no webhooks)   */
/* ------------------------------------------------------------------ */

app.use(express.json({ limit: "10kb" }));

const PAYPAL_BASE = process.env.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
let ppToken = { value: "", exp: 0 };

async function paypalAuth() {
  if (ppToken.value && Date.now() < ppToken.exp) return ppToken.value;
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await res.json();
  if (!res.ok) throw new Error("PayPal login failed. Check your client ID and secret.");
  ppToken = { value: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 };
  return ppToken.value;
}

async function paypalSubscription(id) {
  const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${await paypalAuth()}` }
  });
  return res.ok ? res.json() : null;
}

// Active, or cancelled but already paid up to a future billing date.
function subscriptionActive(sub) {
  if (sub.status === "ACTIVE") return true;
  const until = sub.billing_info && sub.billing_info.next_billing_time;
  return sub.status === "CANCELLED" && !!until && Date.parse(until) > Date.now();
}

async function syncSubscription(user) {
  const sub = await paypalSubscription(user.paypal_subscription_id);
  if (!sub) return user;
  const { data } = await supabase.from("users").update({
    plan: subscriptionActive(sub) ? "premium" : "free",
    subscription_status: String(sub.status || "unknown").toLowerCase(),
    paypal_checked_at: new Date().toISOString()
  }).eq("id", user.id).select().single();
  return data || user;
}

// Re-checks PayPal at most every 6 hours, so cancellations are picked up without webhooks.
async function maybeSync(user) {
  try {
    const stale = !user.paypal_checked_at || Date.now() - Date.parse(user.paypal_checked_at) > 6 * 3600 * 1000;
    return paypalReady() && user.paypal_subscription_id && stale ? await syncSubscription(user) : user;
  } catch (err) {
    console.error(err);
    return user;
  }
}

app.get("/api/billing/config", (req, res) => res.json({
  ready: paypalReady(),
  client_id: paypalReady() ? PAYPAL_CLIENT_ID : null,
  plan_id: paypalReady() ? PAYPAL_PLAN_ID : null
}));

app.post("/api/billing/activate", requireAuth, wrap(async (req, res) => {
  if (!paypalReady()) return res.status(503).json({ error: "Payments aren't set up yet." });

  const id = typeof req.body.subscription_id === "string" ? req.body.subscription_id.trim() : "";
  if (!/^I-[A-Z0-9]{6,40}$/.test(id)) return res.status(400).json({ error: "Invalid subscription." });

  const sub = await paypalSubscription(id);
  if (!sub || sub.plan_id !== PAYPAL_PLAN_ID || String(sub.custom_id) !== String(req.user.id)) {
    return res.status(400).json({ error: "We couldn't verify that payment. Contact support if you were charged." });
  }

  const active = subscriptionActive(sub);
  const { data, error } = await supabase.from("users").update({
    paypal_subscription_id: id,
    plan: active ? "premium" : req.user.plan,
    subscription_status: String(sub.status).toLowerCase(),
    paypal_checked_at: new Date().toISOString()
  }).eq("id", req.user.id).select().single();

  if (error) { console.error(error); return res.status(500).json({ error: "Could not save your subscription." }); }
  res.json({ success: true, pending: !active, user: await publicUser(data) });
}));

/* ------------------------------------------------------------------ */
/* PUBLIC ROUTES                                                       */
/* ------------------------------------------------------------------ */

app.get("/", (req, res) => res.json({ name: "Skyscope API", status: "online", date: getToday() }));

app.get("/health", (req, res) => res.json({
  status: "ok", supabase: !!supabase,
  sessions: !!SESSION_SECRET && SESSION_SECRET.length >= 32,
  payments: paypalReady(), date: getToday()
}));

let statsCache = { at: 0, data: null };
app.get("/api/stats", wrap(async (req, res) => {
  if (!supabase) return res.json({ players: 0, quizzes_taken: 0 });
  if (statsCache.data && Date.now() - statsCache.at < 60000) return res.json(statsCache.data);
  const [u, q] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("quiz_results").select("id", { count: "exact", head: true })
  ]);
  statsCache = { at: Date.now(), data: { players: u.count || 0, quizzes_taken: q.count || 0 } };
  res.json(statsCache.data);
}));

app.get("/api/leaderboard", wrap(async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "The server isn't fully configured yet." });
  const view = req.query.period === "week" ? "leaderboard_week" : "leaderboard_all";

  const { data, error } = await supabase.from(view).select("username, points, quizzes, best_streak")
    .order("points", { ascending: false }).order("best_streak", { ascending: false }).limit(50);
  if (error) { console.error(error); return res.status(500).json({ error: "Could not load the leaderboard." }); }

  let me = null;
  if (authReady()) {
    const user = await userFromRequest(req).catch(() => null);
    if (user && user.username) {
      const { data: mine } = await supabase.from(view).select("username, points, quizzes, best_streak").eq("username", user.username).maybeSingle();
      if (mine) {
        const { count } = await supabase.from(view).select("username", { count: "exact", head: true }).gt("points", mine.points);
        me = { ...mine, rank: (count || 0) + 1 };
      }
    }
  }

  res.json({
    success: true, period: req.query.period === "week" ? "week" : "all",
    entries: (data || []).map((row, i) => ({ rank: i + 1, ...row })), me
  });
}));

/* ------------------------------------------------------------------ */
/* ACCOUNTS                                                            */
/* ------------------------------------------------------------------ */

app.post("/api/signup", wrap(async (req, res) => {
  if (!authReady()) return res.status(500).json({ error: "The server isn't fully configured yet." });
  if (tooMany(`signup:${req.ip}`, 10)) return res.status(429).json({ error: "Too many attempts. Wait a few minutes and try again." });

  const email = cleanEmail(req.body.email);
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const sign = String(req.body.star_sign || "").toLowerCase();

  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!validUsername(username)) return res.status(400).json({ error: "Usernames are 3 to 20 letters, numbers or underscores." });
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: "Your password must be 8 to 200 characters." });
  if (!KEYS.includes(sign)) return res.status(400).json({ error: "Choose your star sign." });

  const usernameLower = username.toLowerCase();
  const [byEmail, byName] = await Promise.all([
    supabase.from("users").select("*").eq("email", email).maybeSingle(),
    supabase.from("users").select("email").eq("username_lower", usernameLower).maybeSingle()
  ]);
  if (byEmail.error || byName.error) { console.error(byEmail.error || byName.error); return res.status(500).json({ error: "Could not create your account." }); }

  const existing = byEmail.data;
  if (existing && existing.password_hash) return res.status(409).json({ error: "An account with this email already exists. Sign in instead." });
  if (byName.data && byName.data.email !== email) return res.status(409).json({ error: "That username is taken. Try another." });

  const fields = { username, username_lower: usernameLower, password_hash: await hashPassword(password), star_sign: sign };
  const query = existing
    ? supabase.from("users").update(fields).eq("email", email)
    : supabase.from("users").insert({ email, plan: "free", subscription_status: "none", ...fields });
  const { data: user, error } = await query.select().single();

  if (error) {
    if (error.code === "23505") return res.status(409).json({ error: "That username or email is already taken." });
    console.error(error);
    return res.status(500).json({ error: "Could not create your account." });
  }
  res.json({ success: true, token: signToken(user.email), user: await publicUser(user) });
}));

app.post("/api/login", wrap(async (req, res) => {
  if (!authReady()) return res.status(500).json({ error: "The server isn't fully configured yet." });

  const identifier = String(req.body.identifier || req.body.email || "").trim().toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!identifier || !password || password.length > 200 || identifier.length > 254) {
    return res.status(400).json({ error: "Enter your email or username and your password." });
  }
  if (tooMany(`login-ip:${req.ip}`, 20) || tooMany(`login:${identifier}`, 8)) {
    return res.status(429).json({ error: "Too many attempts. Wait a few minutes and try again." });
  }

  const column = identifier.includes("@") ? "email" : "username_lower";
  const { data: user, error } = await supabase.from("users").select("*").eq(column, identifier).maybeSingle();
  if (error) { console.error(error); return res.status(500).json({ error: "Could not sign you in." }); }

  if (user && !user.password_hash) {
    return res.status(401).json({ error: "This account has no password yet. Choose Create account to finish setting it up." });
  }
  const ok = user ? await checkPassword(password, user.password_hash) : (await checkPassword(password, "00:00"), false);
  if (!ok) return res.status(401).json({ error: "Incorrect login details." });

  res.json({ success: true, token: signToken(user.email), user: await publicUser(user) });
}));

app.get("/api/profile", requireAuth, wrap(async (req, res) => {
  req.user = await maybeSync(req.user);
  res.json({ success: true, user: await publicUser(req.user) });
}));

/* ------------------------------------------------------------------ */
/* HOME, NOTIFICATIONS                                                 */
/* ------------------------------------------------------------------ */

app.get("/api/home", requireAuth, wrap(async (req, res) => {
  req.user = await maybeSync(req.user);
  res.json({
    success: true,
    user: await publicUser(req.user),
    today: getDailyContent(req.user.star_sign),
    extras: isPremium(req.user) ? premiumExtras(req.user.star_sign) : null
  });
}));

// A daily mood notification for each of the last 7 days, plus a quiz reminder if today's quiz isn't done.
app.get("/api/notifications", requireAuth, wrap(async (req, res) => {
  const today = getToday();
  const items = [];

  if (!(await findResult(req.user.email, today))) {
    items.push({ type: "quiz", date: today, title: "Today's quiz is ready", message: "Five new questions are waiting. Finish them to keep your streak and climb the leaderboard." });
  }
  for (let i = 0; i < 7; i++) {
    const date = shiftDay(today, -i);
    const c = getDailyContent(req.user.star_sign, date);
    items.push({ type: "mood", date, title: `${c.mood} mood`, message: c.mood_text, energy: c.cosmic_energy });
  }
  res.json({ success: true, notifications: items });
}));

/* ------------------------------------------------------------------ */
/* QUIZ                                                                */
/* ------------------------------------------------------------------ */

app.get("/api/quiz", requireAuth, wrap(async (req, res) => {
  const today = getToday();
  const done = await findResult(req.user.email, today);
  if (done) return res.json({ success: true, date: today, completed: true, result: formatResult(done) });

  res.json({
    success: true, date: today, completed: false,
    questions: buildQuiz(today).map((q, i) => ({ id: i + 1, question: q.question, options: q.options }))
  });
}));

app.post("/api/quiz/submit", requireAuth, wrap(async (req, res) => {
  const { email, star_sign: sign } = req.user;
  const answers = req.body.answers;
  const today = getToday();
  const date = typeof req.body.date === "string" ? req.body.date : today;

  if (date !== today && date !== shiftDay(today, -1)) return res.status(400).json({ error: "This quiz has expired. Reload today's quiz." });

  const questions = buildQuiz(date);
  const valid = Array.isArray(answers) && answers.length === questions.length &&
    answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < questions[i].options.length);
  if (!valid) return res.status(400).json({ error: `Answer all ${questions.length} questions.` });

  const existing = await findResult(email, date);
  if (existing) return res.json({ success: true, already: true, result: formatResult(existing) });

  const score = questions.reduce((t, q, i) => t + (answers[i] === q.correct ? 1 : 0), 0);

  const { data: prev, error: prevError } = await supabase.from("quiz_results").select("quiz_date, streak")
    .eq("email", email).lt("quiz_date", date).order("quiz_date", { ascending: false }).limit(1);
  if (prevError) { console.error(prevError); return res.status(500).json({ error: "Could not save your result." }); }

  const last = prev && prev[0];
  const streak = last && last.quiz_date === shiftDay(date, -1) ? (last.streak || 0) + 1 : 1;

  const { data: saved, error } = await supabase.from("quiz_results")
    .insert({ email, star_sign: sign, quiz_date: date, score, total_questions: questions.length, streak }).select().single();

  if (error) {
    if (error.code === "23505") {
      const again = await findResult(email, date);
      if (again) return res.json({ success: true, already: true, result: formatResult(again) });
    }
    console.error(error);
    return res.status(500).json({ error: "Could not save your result." });
  }
  res.json({ success: true, already: false, result: formatResult(saved) });
}));

/* ------------------------------------------------------------------ */
/* ERRORS AND START                                                    */
/* ------------------------------------------------------------------ */

app.use((req, res) => res.status(404).json({ error: "Endpoint not found." }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Skyscope backend running on port ${PORT}`);
    console.log(`Supabase: ${!!supabase} | Sessions: ${authReady()} | Payments: ${paypalReady()}`);
  });
} else {
  module.exports = { buildQuiz };
}
