const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

const userData = {};
let isOpen = false;

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  await Promise.all(events.map(handleEvent));
  res.status(200).end();
});

function parseInput(text) {
  const parts = text.trim().split(/\s+/);
  const list = [];

  for (const part of parts) {
    const match = part.match(/^([1-6])\/(\d+)$/);

    if (!match) {
      return {
        ok: false,
        message: 'รูปแบบไม่ถูกต้อง\nตัวอย่าง: 1/100 หรือ 1/100 2/50'
      };
    }

    const choice = Number(match[1]);
    const points = Number(match[2]);

    if (points < 10) {
      return {
        ok: false,
        message: 'ขั้นต่ำ 10 บาท\nตัวอย่าง: 1/10'
      };
    }

    list.push({
      choice,
      points,
      reserve: points * 2
    });
  }

  return { ok: true, list };
}

function createUser(userId) {
  if (!userData[userId]) {
    userData[userId] = {
      entries: []
    };
  }
}

function resetAllUsers() {
  for (const id in userData) {
    userData[id] = {
      entries: []
    };
  }
}

function getSummary(userId) {
  createUser(userId);

  const totals = {
    1: { points: 0, reserve: 0 },
    2: { points: 0, reserve: 0 },
    3: { points: 0, reserve: 0 },
    4: { points: 0, reserve: 0 },
    5: { points: 0, reserve: 0 },
    6: { points: 0, reserve: 0 }
  };

  userData[userId].entries.forEach(item => {
    totals[item.choice].points += item.points;
    totals[item.choice].reserve += item.reserve;
  });

  let reply = 'สรุปคะแนนของคุณ\n\n';
  let totalPoints = 0;
  let totalReserve = 0;

  for (let i = 1; i <= 6; i++) {
    totalPoints += totals[i].points;
    totalReserve += totals[i].reserve;

    reply += `ขาที่ ${i}: ${totals[i].points} บาท | กันไว้ ${totals[i].reserve} บาท\n`;
  }

  reply += `\nรวมคะแนนจริง: ${totalPoints} บาท`;
  reply += `\nรวมคะแนนกันไว้: ${totalReserve} บาท`;

  return reply;
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const text = event.message.text.trim();

  const baseUrl = 'https://line-bot-8ro4.onrender.com';

  const images = {
    open: `${baseUrl}/open.jpg.png`,
    close: `${baseUrl}/close.jpg.png`,
    '1': `${baseUrl}/1.jpg.png`,
    '2': `${baseUrl}/2.jpg.png`,
    '3': `${baseUrl}/3.jpg.png`
  };

  // เปิด = ส่งรูปเปิดอย่างเดียว + เริ่มนับใหม่
  if (text === 'เปิด') {
    isOpen = true;
    resetAllUsers();

    return client.replyMessage(event.replyToken, {
      type: 'image',
      originalContentUrl: images.open,
      previewImageUrl: images.open
    });
  }

  // ปิด = ส่งรูปปิดอย่างเดียว + ปิดรับลงคะแนน
  if (text === 'ปิด') {
    isOpen = false;

    return client.replyMessage(event.replyToken, {
      type: 'image',
      originalContentUrl: images.close,
      previewImageUrl: images.close
    });
  }

  // ส่งรูป 1, 2, 3
  if (images[text]) {
    return client.replyMessage(event.replyToken, {
      type: 'image',
      originalContentUrl: images[text],
      previewImageUrl: images[text]
    });
  }

  // ดูสรุป
  if (text.toLowerCase() === 'c') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: getSummary(userId)
    });
  }

  // ล้างคะแนนตัวเอง
  if (text.toLowerCase() === 'x') {
    userData[userId] = {
      entries: []
    };

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ยกเลิกการเดิมพัน'
    });
  }

  // ถ้าปิดอยู่
  if (!isOpen) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ปิดรับการเดิมพัน❌'
    });
  }

  const result = parseInput(text);

  if (!result.ok) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: result.message
    });
  }

  createUser(userId);

  let reply = 'บันทึกการเดิมพัน\n\n';

  result.list.forEach(item => {
    userData[userId].entries.push(item);

    reply += `ขาที่ ${item.choice} +${item.points} บาท\n`;
    reply += `กันคะแนนไว้ ${item.reserve} บาท\n\n`;
  });

  reply += getSummary(userId);

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: reply
  });
}

app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
