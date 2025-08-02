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
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid events format' });
    }

    const results = await Promise.all(
      events.map(async (event) => {
        try {
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
  
  if (!userMessage || userMessage.trim() === '') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'กรุณาส่งข้อความที่ต้องการแปลค่ะ'
    });
  }

  try {
    // ตรวจสอบภาษา (ไทยหรือพม่า)
    const isThai = /[\u0E00-\u0E7F]/.test(userMessage); // ตรวจสอบอักษรไทย
    const isBurmese = /[\u1000-\u109F]/.test(userMessage); // ตรวจสอบอักษรพม่า
    
    let sourceLang, targetLang;
    
    if (isThai) {
      sourceLang = 'th';
      targetLang = 'my'; // พม่า
    } else if (isBurmese) {
      sourceLang = 'my';
      targetLang = 'th'; // ไทย
    } else {
      // ถ้าไม่ใช่ทั้งไทยและพม่า ให้ถือว่าเป็นภาษาอังกฤษ
      sourceLang = 'en';
      targetLang = 'th'; // แปลเป็นไทย
    }

    // เรียกใช้ MyMemory Translation API
    const response = await axios.get(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(userMessage)}&langpair=${sourceLang}|${targetLang}`
    );

    let translatedText = response.data?.responseData?.translatedText || 
                       'ไม่สามารถแปลข้อความนี้ได้ในขณะนี้';

    // กรณีที่แปลพม่าเป็นไทย แต่ API คืนค่ามาเป็นภาษาอังกฤษ
    if (sourceLang === 'my' && targetLang === 'th' && 
        /[a-zA-Z]/.test(translatedText) && !/[\u0E00-\u0E7F]/.test(translatedText)) {
      translatedText = 'ขออภัย ระบบสามารถแปลพม่าเป็นอังกฤษได้ แต่แปลเป็นไทยโดยตรงไม่ได้ในขณะนี้';
    }

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
    service: 'LINE Translation Bot (ไทย-พม่า)',
    supported_languages: {
      th: 'ไทย',
      my: 'พม่า',
      en: 'อังกฤษ'
    }
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
  console.log(`Translation Bot (ไทย-พม่า) กำลังทำงานที่พอร์ต ${PORT}`);
});
