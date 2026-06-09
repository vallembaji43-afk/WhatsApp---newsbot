const twilio = require("twilio");
const axios = require("axios");
const xml2js = require("xml2js");
const cron = require("node-cron");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.FROM_WHATSAPP;
const TO = process.env.TO_WHATSAPP;

async function fetchRSS(url, limit = 3) {
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const parsed = await xml2js.parseStringPromise(data);
    const items = parsed.rss.channel[0].item || [];
    return items.slice(0, limit).map((item) => ({
      title: item.title[0].substring(0, 60),
      link: item.link[0],
    }));
  } catch (err) {
    return [];
  }
}

async function buildMessage() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short", month: "short", day: "numeric",
  });

  const [bbcNews, aiNews] = await Promise.all([
    fetchRSS("http://feeds.bbci.co.uk/news/rss.xml", 3),
    fetchRSS("https://news.google.com/rss/search?q=AI+news&hl=en-IN", 2),
  ]);

  let msg = `🌅 *Good Morning Baji!*\n📅 ${today}\n\n`;

  msg += `🔴 *BBC NEWS*\n`;
  bbcNews.forEach((n, i) => {
    msg += `${i + 1}. ${n.title}\n${n.link}\n\n`;
  });

  msg += `🤖 *AI UPDATES*\n`;
  aiNews.forEach((n, i) => {
    msg += `${i + 1}. ${n.title}\n${n.link}\n\n`;
  });

  msg += `✨ Have a great day! 🚀`;
  return msg;
}

async function sendWhatsApp() {
  const body = await buildMessage();
  console.log("Message length:", body.length);
  try {
    await client.messages.create({ from: FROM, to: TO, body });
    console.log("✅ Sent!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

cron.schedule("30 23 * * *", () => {
  sendWhatsApp();
}, { timezone: "UTC" });

console.log("🤖 NewsBot Running!");
console.log("📲 Will send to:", TO);

if (process.env.SEND_NOW === "true") {
  sendWhatsApp();
}
