import prisma from "../prisma.js";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function analyzeContext(contextId) {
  // 1. Lấy PersonalContext từ PostgreSQL
  const context = await prisma.personalContext.findUnique({
    where: {
      id: contextId,
    },
    include: {
      source: true,
      user: {
        include: {
          preferences: {
            orderBy: {
              updatedAt: "desc",
            },
          },
        },
      },
    },
  });

  if (!context) {
    throw new Error("Context not found");
  }

  // 2. Chuẩn bị ContextPreference cho Gemini
  const preferencesText =
    context.user?.preferences?.length > 0
      ? context.user.preferences
          .map(
            (preference, index) => `
Preference ${index + 1}:
Type: ${preference.type}
Content: ${preference.content}
Confidence: ${preference.confidence ?? "null"}
`
          )
          .join("\n")
      : "Chưa có ContextPreference nào.";

  // 3. Tạo prompt gửi cho Gemini
  const prompt = `
Bạn là AI phân tích ngữ cảnh cho một trợ lý AI cá nhân chủ động.

Hãy phân tích PersonalContext sau:

ID: ${context.id}
Loại ngữ cảnh: ${context.type}
Nội dung: ${context.content}
Mức độ quan trọng: ${context.importance}/5
Nguồn: ${context.source?.name || "Không xác định"}
Thời gian hiện tại: ${new Date().toISOString()}
Múi giờ địa phương: UTC+07:00

ContextPreference của người dùng:

${preferencesText}

Hãy sử dụng các ContextPreference trên để cá nhân hóa phân tích.

Quy tắc sử dụng ContextPreference:
- Nếu có preference phù hợp với PersonalContext, phải cân nhắc preference đó khi
  xác định needsAction, actionType và recommendation.
- Nếu preference của người dùng mâu thuẫn với một hành động được đề xuất, ưu tiên
  preference của người dùng.
- Không được tự tạo hoặc thay đổi ContextPreference trong bước này.
- Không được bỏ qua preference chỉ vì cách diễn đạt của PersonalContext khác với
  content của preference.
- Confidence của preference chỉ thể hiện mức độ tin cậy của preference, không phải
  mức độ quan trọng của PersonalContext.
- Nếu không có preference liên quan, phân tích PersonalContext theo các quy tắc
  thông thường.

Hãy trả về DUY NHẤT một JSON hợp lệ theo cấu trúc:

{
  "summary": "Tóm tắt ngắn gọn ngữ cảnh",
  "category": "schedule|task|deadline|reminder|information|other",
  "importance": 1,
  "needsAction": true,
  "actionType": "task|notification|recommendation|none",
  "suggestedTask": {
    "title": "Tên công việc được đề xuất",
    "description": "Mô tả công việc",
    "priority": "low|medium|high",
    "dueDate": null
  },
  "risk": null,
  "recommendation": null
}

Quy tắc:
- importance phải là số nguyên từ 1 đến 5.
- needsAction là true hoặc false.
- actionType chỉ được là: task, notification, recommendation hoặc none.
- Nếu không cần tạo task thì suggestedTask phải là null.
- Nếu ngữ cảnh có thời hạn hoặc thời điểm thực hiện cụ thể, hãy trích xuất vào suggestedTask.dueDate.
- dueDate phải là chuỗi ISO 8601 hợp lệ, ví dụ: "2026-09-20T18:00:00+07:00".
- Nếu nội dung chỉ có ngày mà không có giờ, có thể dùng 00:00:00 theo múi giờ +07:00.
- Nếu nội dung có giờ nhưng không có ngày, chỉ suy ra ngày nếu ngữ cảnh xác định rõ ngày đó; nếu không xác định được thì dueDate phải là null.
- Với các cụm tương đối như "ngày mai", "thứ 6", "tuần sau", chỉ chuyển thành ngày cụ thể khi có đủ thông tin về ngày hiện tại trong ngữ cảnh.
- Không được tự bịa hoặc đoán thời hạn. Nếu không xác định chắc chắn thời điểm thì dueDate phải là null.
- Nếu không phát hiện rủi ro thì risk phải là null.
- Nếu không có đề xuất thì recommendation phải là null.
- Không thêm Markdown.
- Không thêm Markdown code block.
- Chỉ trả về JSON.
`;

  // 4. Gọi Gemini
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
  });

  // 5. Lấy nội dung Gemini trả về
  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  // 6. Parse JSON
  let analysis;

  try {
    analysis = JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse Gemini response:", text);
    throw new Error("Gemini returned invalid JSON");
  }

  // 7. Lưu AIInsight
  const insight = await prisma.aIInsight.create({
    data: {
      summary: analysis.summary,
      category: analysis.category,
      importance: analysis.importance,
      confidence: analysis.confidence ?? null,
      needsAction: analysis.needsAction,
      actionType: analysis.actionType,
      suggestedTask: analysis.suggestedTask ?? null,
      risk: analysis.risk ?? null,
      recommendation: analysis.recommendation ?? null,
      contextId: context.id,
    },
  });

  return insight;
}