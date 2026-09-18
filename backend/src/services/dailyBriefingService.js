import prisma from "../prisma.js";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function generateBriefingWithRetry(prompt, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });
    } catch (error) {
      const status = error?.status;

      if (status !== 503 || attempt === maxRetries) {
        throw error;
      }

      const delay = attempt * 2000;

      console.warn(
        `Gemini Daily Briefing returned 503. Retry ${attempt}/${maxRetries - 1} after ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function generateDailyBriefing(userId) {
  const [tasks, notifications, insights] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        status: {
          not: "completed",
        },
      },
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),

    prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.aIInsight.findMany({
      where: {
        context: {
          userId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
  ]);

  const briefingData = {
    currentTime: new Date().toISOString(),
    timezone: "UTC+07:00",
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    })),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    })),
    insights: insights.map((insight) => ({
      id: insight.id,
      summary: insight.summary,
      category: insight.category,
      importance: insight.importance,
      needsAction: insight.needsAction,
      actionType: insight.actionType,
      risk: insight.risk,
      recommendation: insight.recommendation,
      createdAt: insight.createdAt,
    })),
  };

  const prompt = `
Bạn là AI tạo Daily Briefing cho một trợ lý AI cá nhân chủ động.

Hãy tạo bản tổng hợp ngắn gọn, thực tế và hữu ích dựa CHỈ trên dữ liệu được cung cấp.

Thời gian hiện tại:
${briefingData.currentTime}

Múi giờ:
${briefingData.timezone}

DỮ LIỆU:

TASKS:
${JSON.stringify(briefingData.tasks, null, 2)}

NOTIFICATIONS:
${JSON.stringify(briefingData.notifications, null, 2)}

AI INSIGHTS:
${JSON.stringify(briefingData.insights, null, 2)}

Hãy trả về DUY NHẤT JSON hợp lệ theo cấu trúc:

{
  "greeting": "Lời chào ngắn",
  "summary": "Tóm tắt tình hình tổng quan",
  "priorities": [
    {
      "title": "Việc cần ưu tiên",
      "reason": "Lý do",
      "priority": "low|medium|high"
    }
  ],
  "upcomingTasks": [
    {
      "title": "Tên công việc",
      "dueDate": "ISO 8601 hoặc null",
      "priority": "low|medium|high"
    }
  ],
  "alerts": [
    {
      "title": "Cảnh báo",
      "message": "Nội dung cảnh báo"
    }
  ],
  "recommendations": [
    "Đề xuất hành động"
  ]
}

Quy tắc:
- Chỉ sử dụng thông tin có trong dữ liệu.
- Không tự bịa thêm công việc, deadline hoặc sự kiện.
- Ưu tiên task có deadline gần hoặc priority cao.
- Nếu không có dữ liệu ở một phần, trả về mảng rỗng.
- Không thêm Markdown.
- Không thêm Markdown code block.
- Chỉ trả về JSON.
`;

  const response = await generateBriefingWithRetry(prompt);

  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  let briefing;

  try {
    briefing = JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse Daily Briefing response:", text);
    throw new Error("Gemini returned invalid JSON");
  }

  return {
    userId,
    generatedAt: new Date(),
    data: briefingData,
    briefing,
  };
}
