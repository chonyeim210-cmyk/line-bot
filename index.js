const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

const userData = {};
const members = {};

let isOpen = false;
let nextMemberCode = 1;

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  await Promise.all(events.map(handleEvent));
  res.status(200).end();
});

function makeMemberCode() {
  const code = String(nextMemberCode).padStart(4, '0');
  nextMemberCode++;

  if (nextMemberCode > 9999) {
    nextMemberCode = 1;
  }

  return code;
}

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
        message: 'ขั้นต่ำ 10 คะแนน\nตัวอย่าง: 1/10'
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

  const member = members[userId];

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

  if (member) {
    reply += `รหัส: ${member.code}\n`;
    reply += `ชื่อ: ${member.name}\n\n`;
  }

  let totalPoints = 0;
  let totalReserve = 0;

  for (let i = 1; i <= 6; i++) {
    totalPoints += totals[i].points;
    totalReserve += totals[i].reserve;

    reply += `ขาที่ ${i}: ${totals[i].points} คะแนน | กันไว้ ${totals[i].reserve} คะแนน\n`;
  }

  reply += `\nรวมคะแนนจริง: ${totalPoints} คะแนน`;
  reply += `\nรวมคะแนนกันไว้: ${totalReserve} คะแนน`;

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

  if (text.startsWith('สมัคร ')) {
    const name = text.replace('สมัคร ', '').trim();

    if (!name) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'กรุณาพิมพ์: สมัคร ชื่อเล่น'
      });
    }

    if (!members[userId]) {
      members[userId] = {
        code: makeMemberCode(),
        name
      };
    } else {
      members[userId].name = name;
    }

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text:
`สมัครเรียบร้อย

รหัส: ${members[userId].code}
ชื่อ: ${members[userId].name}`
    });
  }

  if (text === 'ฉัน') {
    if (!members[userId]) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'ยังไม่ได้สมัคร\nพิมพ์: สมัคร ชื่อเล่น'
      });
    }

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text:
`ข้อมูลของคุณ

รหัส: ${members[userId].code}
ชื่อ: ${members[userId].name}`
    });
  }

  if (text === 'เปิด') {
    isOpen = true;
    resetAllUsers();

    return client.replyMessage(event.replyToken, {
      type: 'image',
      originalContentUrl: images.open,
      previewImageUrl: images.open
    });
  }

  if (text === 'ปิด') {
    isOpen = false;

    return client.replyMessage(event.replyToken, {
      type: 'image',
      originalContentUrl: images.close,
      previewImageUrl: images.close
    });
  }

  if (images[text]) {
    return client.replyMessage(event.replyToken, {
      type: 'image',
      originalContentUrl: images[text],
      previewImageUrl: images[text]
    });
  }

  if (text.toLowerCase() === 'c') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: getSummary(userId)
    });
  }

  if (text.toLowerCase() === 'x') {
    userData[userId] = {
      entries: []
    };

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ล้างคะแนนของคุณเรียบร้อยแล้ว'
    });
  }

  if (!isOpen) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ปิดรับลงคะแนน'
    });
  }

  if (!members[userId]) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'กรุณาสมัครก่อน\nพิมพ์: สมัคร ชื่อเล่น'
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

  let reply =
`บันทึกคะแนนเรียบร้อย

รหัส: ${members[userId].code}
ชื่อ: ${members[userId].name}

`;

  result.list.forEach(item => {
    userData[userId].entries.push(item);

    reply += `ขาที่ ${item.choice} +${item.points} คะแนน\n`;
    reply += `กันคะแนนไว้ ${item.reserve} คะแนน\n\n`;
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
