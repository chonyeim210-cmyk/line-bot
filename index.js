const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

const userData = {};

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

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userId = event.source.userId;
  const text = event.message.text.trim();

  const baseUrl = 'https://line-bot-8ro4.onrender.com';

  const images = {
    'เปิด': `${baseUrl}/open.jpg.png`,
    'ปิด': `${baseUrl}/close.jpg.png`,
    '1': `${baseUrl}/1.jpg.png`,
    '2': `${baseUrl}/2.jpg.png`,
    '3': `${baseUrl}/3.jpg.png`
  };

  if (images[text]) {
    return client.replyMessage(event.replyToken, {
      type: 'image',
      originalContentUrl: images[text],
      previewImageUrl: images[text]
    });
  }

  if (text === 'เมนู') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text:
`ระบบเลือกขาและเก็บคะแนน

รูปแบบ:
ขา/จำนวน

ตัวอย่าง:
1/100
2/100
3/100
4/100
5/100
6/100

เลือกหลายขาพร้อมกันได้:
1/100 2/50 3/200

ระบบจะกันยอดไว้ x2
เช่น 1/100 = กันยอด 200

คำสั่ง:
c = ดูคะแนนของคุณ
x = ล้างคะแนนของคุณ`
    });
  }

  if (text.toLowerCase() === 'c') {
    const data = userData[userId];

    if (!data) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'ยังไม่มีข้อมูลคะแนน'
      });
    }

    let reply = 'สรุปคะแนนของคุณ\n\n';
    let totalPoints = 0;
    let totalReserve = 0;

    for (let i = 1; i <= 6; i++) {
      const point = data.points[i] || 0;
      const reserve = data.reserve[i] || 0;

      totalPoints += point;
      totalReserve += reserve;

      reply += `ขาที่ ${i}: ${point} บาท | กันไว้ ${reserve} บาท\n`;
    }

    reply += `\nรวมยอดจริง: ${totalPoints} บาท`;
    reply += `\nรวมยอดกันไว้: ${totalReserve} บาท`;

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: reply
    });
  }

  if (text.toLowerCase() === 'x') {
    delete userData[userId];

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ล้างคะแนนเรียบร้อยแล้ว'
    });
  }

  const result = parseInput(text);

  if (result.ok) {
    if (!userData[userId]) {
      userData[userId] = {
        points: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        reserve: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      };
    }

    let reply = 'บันทึกข้อมูลเรียบร้อย\n\n';

    result.list.forEach(item => {
      userData[userId].points[item.choice] += item.points;
      userData[userId].reserve[item.choice] += item.reserve;

      reply += `ขาที่ ${item.choice} +${item.points} บาท\n`;
      reply += `กันยอดไว้ ${item.reserve} บาท\n\n`;
    });

    let totalPoints = 0;
    let totalReserve = 0;

    for (let i = 1; i <= 6; i++) {
      totalPoints += userData[userId].points[i];
      totalReserve += userData[userId].reserve[i];
    }

    reply += `รวมยอดจริงตอนนี้: ${totalPoints} บาท`;
    reply += `\nรวมยอดกันไว้ตอนนี้: ${totalReserve} บาท`;

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: reply
    });
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: 'พิมพ์ เมนู เพื่อดูวิธีใช้งาน'
  });
}

app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
