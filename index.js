const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

// ✅ LINE Middleware ตรวจลายเซ็น และให้ access req.body.events แล้ว
app.post(
  '/webhook',
  line.middleware(config),
  async (req, res) => {
    try {
      const events = req.body.events;

      const results = await Promise.all(events.map(handleEvent));
      res.status(200).json(results);
    } catch (err) {
      console.error("❌ Webhook error:", err);
      res.status(500).send('Error!');
    }
  }
);

// ✅ ฟังก์ชันแปลภาษาไทย ↔ อังกฤษ
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  const text = event.message.text;
  const isEnglish = /^[A-Za-z0-9\s.,'"!?;:()\-]+$/.test(text);
  const sourceLang = isEnglish ? 'en' : 'th';
  const targetLang = isEnglish ? 'th' : 'en';

  try {
    const translated = await axios.post('https://libretranslate.com/translate', {
      q: text,
      source: sourceLang,
      target: targetLang,
      format: 'text',
    });

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: translated.data.translatedText,
    });

  } catch (error) {
    console.error("❌ Translate error:", error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'เกิดข้อผิดพลาดในการแปล: ' + error.message,
    });
  }
}

// ✅ แสดงข้อความหน้าเว็บ root
app.get('/', (req, res) => res.send('LINE Translate Bot is running.'));
app.listen(process.env.PORT || 3000);
