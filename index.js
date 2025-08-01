const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const bodyParser = require('body-parser');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

// ✅ ต้องวาง line.middleware ก่อน bodyParser.raw
app.post(
  '/webhook',
  line.middleware(config),
  bodyParser.raw({ type: '*/*' }),
  async (req, res) => {
    try {
      const bodyString = req.body.toString();
      const parsedBody = JSON.parse(bodyString);
      const events = parsedBody.events;

      const results = await Promise.all(events.map(handleEvent));
      res.status(200).json(results);
    } catch (err) {
      console.error("❌ Webhook error:", err);
      res.status(500).send('Error!');
    }
  }
);

// ✅ ฟังก์ชันแปลภาษาอัตโนมัติ
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  const text = event.message.text;

  // ตรวจว่าเป็นอังกฤษหรือไม่
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

// ✅ สำหรับเปิดหน้าเว็บ root
app.get('/', (req, res) => res.send('LINE Translate Bot is running.'));
app.listen(process.env.PORT || 3000);
