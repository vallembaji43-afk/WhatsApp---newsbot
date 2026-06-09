const twilio = require("twilio");
const axios = require("axios");
const xml2js = require("xml2js");
const cron = require("node-cron");

// ── Twilio setup ──────────────────────────────────────────
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.FROM_WHATSAPP; // whatsapp:+14155238886
const TO   = process.env.TO_WHATSAPP;   // whatsapp:+91XXXXXXXXXX

// ── RSS fetcher ───────────────────────────────────────────
async function fetchRSS(url, limit = 5) {
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const parsed   = await xml2js.parseStringPromise(data);
    const items    = parsed.rss.channel[0].item || [];
    return items.slice(0, limit).map((item) => ({
      title: item.title[0],
      link:  item.link[0],
    }));
  } catch (err) {
    console.error("RSS fetch error:", url, err.message);
    return [];
  }
}

// ── Build WhatsApp message ────────────────────────────────
async function buildMessage() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const [bbcNews, aiNews, techNews] = await Promise.all([
    fetchRSS("http://feeds.bbci.co.uk/news/rss.xml", 5),
    fetchRSS("https://news.google.com/rss/search?q=artificial+intelligence&hl=en-IN&gl=IN&ceid=IN:en", 3),
    fetchRSS("https://news.google.com/rss/search?q=technology+india&hl=en-IN&gl=IN&ceid=IN:en", 2),
  ]);

  let msg = `🌅 *Good Morning!*\n📅 ${today}\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `🔴 *BBC TOP NEWS*\n`;
  bbcNews.forEach((n, i) => {
    msg += `${i + 1}. ${n.title}\n🔗 ${n.link}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `🤖 *AI UPDATES*\n`;
  aiNews.forEach((n, i) => {
    msg += `${i + 1}. ${n.title}\n🔗 ${n.link}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `💻 *TECH NEWS INDIA*\n`;
  techNews.forEach((n, i) => {
    msg += `${i + 1}. ${n.title}\n🔗 ${n.link}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `✨ *Have a productive day!* 🚀`;

  return msg;
}

// ── Send WhatsApp ─────────────────────────────────────────
async function sendWhatsApp() {
  console.log("📰 Fetching news...");
  const body = await buildMessage();

  try {
    const message = await client.messages.create({ from: FROM, to: TO, body });
    console.log("✅ WhatsApp sent! SID:", message.sid);
  } catch (err) {
    console.error("❌ WhatsApp send error:", err.message);
  }
}

// ── Scheduler: 5 AM IST = 23:30 UTC (previous day) ───────
// cron format: second minute hour day month weekday
cron.schedule("30 23 * * *", () => {
  console.log("⏰ Cron triggered — sending morning news...");
  sendWhatsApp();
}, { timezone: "UTC" });

console.log("🤖 NewsBot is running! Waiting for 5 AM IST...");
console.log("📲 Will send to:", process.env.TO_WHATSAPP);

// ── Send immediately on startup (for testing) ─────────────
if (process.env.SEND_NOW === "true") {
  console.log("🚀 SEND_NOW=true — sending test message now!");
  sendWhatsApp();
}
