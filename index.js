const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

// ตั้งค่า LINE Messaging API
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || 'YOUR_CHANNEL_ACCESS_TOKEN',
  channelSecret: process.env.CHANNEL_SECRET || 'YOUR_CHANNEL_SECRET',
};

const app = express();
const client = new line.Client(config);

// Middleware สำหรับตรวจสอบ LINE Signature
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Webhook Endpoint
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    
    // ตรวจสอบว่าเป็น Events ที่ต้องการ
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid events format' });
    }

    // ประมวลผลทุก Event
    const results = await Promise.all(
      events.map(async (event) => {
        try {
          // ตรวจสอบว่าเป็น Message Event และเป็น Text Message
          if (event.type === 'message' && event.message.type === 'text') {
            return await handleMessageEvent(event);
          }
          return null;
        } catch (error) {
          console.error('Error processing event:', error);
          return null;
        }
      })
    );

    res.json({ success: true, results });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ฟังก์ชันจัดการข้อความ
async function handleMessageEvent(event) {
  const userMessage = event.message.text;
  
  // ตรวจสอบว่าข้อความไม่ว่างเปล่า
  if (!userMessage || userMessage.trim() === '') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'กรุณาส่งข้อความที่ต้องการแปลค่ะ'
    });
  }

  try {
    // ตรวจสอบภาษา (ภาษาอังกฤษหรือไทย)
    const isEnglish = /^[a-zA-Z0-9\s.,!?;:'"()\-]+$/.test(userMessage);
    const sourceLang = isEnglish ? 'en' : 'th';
    const targetLang = isEnglish ? 'th' : 'en';

    // เรียกใช้ MyMemory Translation API
    const response = await axios.get(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(userMessage)}&langpair=${sourceLang}|${targetLang}`
    );

    // ตรวจสอบว่ามีผลลัพธ์การแปล
    const translatedText = response.data?.responseData?.translatedText || 
                         'ไม่สามารถแปลข้อความนี้ได้ในขณะนี้';

    // ตอบกลับผู้ใช้
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: translatedText
    });

  } catch (error) {
    console.error('Translation error:', error);
    
    // ส่งข้อความแสดงข้อผิดพลาด
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ขออภัย เกิดข้อผิดพลาดในการแปล โปรดลองอีกครั้งในภายหลัง'
    });
  }
}

// Health Check Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    service: 'LINE Translation Bot'
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
