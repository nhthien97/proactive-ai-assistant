import prisma from "../prisma.js";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const GEMINI_MODEL = "gemini-3.6-flash";

export async function refineContextPreference(feedbackId) {
  // ============================================================
  // 1. Lấy Feedback + AIInsight + PersonalContext + User
  // ============================================================
  const feedback = await prisma.feedback.findUnique({
    where: {
      id: feedbackId,
    },
    include: {
      user: true,
      aiInsight: {
        include: {
          context: true,
        },
      },
    },
  });

  if (!feedback) {
    throw new Error("Feedback not found");
  }

  // ============================================================
  // 2. Lấy các ContextPreference hiện có của User
  // ============================================================
  const existingPreferences = await prisma.contextPreference.findMany({
    where: {
      userId: feedback.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const existingPreferencesText =
    existingPreferences.length > 0
      ? existingPreferences
          .map(
            (preference, index) => `
Preference ${index + 1}:
ID: ${preference.id}
Type: ${preference.type}
Content: ${preference.content}
Confidence: ${preference.confidence ?? "null"}
`
          )
          .join("\n")
      : "Chưa có ContextPreference nào.";

  // ============================================================
  // 3. Tạo prompt cho Gemini
  // ============================================================
  const prompt = `
Bạn là AI phân tích phản hồi của người dùng cho một trợ lý AI cá nhân chủ động.

Mục tiêu:
- Phân tích Feedback.
- Kết hợp AIInsight và PersonalContext.
- Xác định Feedback có thể hình thành một preference lâu dài của người dùng hay không.
- Kiểm tra preference mới có trùng về mặt Ý NGHĨA với preference đã tồn tại hay không.

============================================================
THÔNG TIN NGƯỜI DÙNG
============================================================

Tên:
${feedback.user.name || "Không xác định"}

============================================================
FEEDBACK
============================================================

ID:
${feedback.id}

Loại:
${feedback.type}

Nhận xét:
${feedback.comment || "Không có nhận xét"}

============================================================
AIINSIGHT
============================================================

Summary:
${feedback.aiInsight.summary}

Category:
${feedback.aiInsight.category}

Importance:
${feedback.aiInsight.importance}

Needs action:
${feedback.aiInsight.needsAction}

Action type:
${feedback.aiInsight.actionType}

Recommendation:
${feedback.aiInsight.recommendation || "Không có"}

============================================================
PERSONAL CONTEXT
============================================================

Type:
${feedback.aiInsight.context.type}

Content:
${feedback.aiInsight.context.content}

Importance:
${feedback.aiInsight.context.importance}

============================================================
CONTEXT PREFERENCE ĐÃ TỒN TẠI
============================================================

${existingPreferencesText}

============================================================
YÊU CẦU
============================================================

Hãy xác định:

1. Feedback có phản ánh một sở thích, hành vi hoặc quy luật có khả năng hữu ích
   cho những lần phân tích ngữ cảnh sau hay không.

2. Nếu có preference:
   - Xác định type.
   - Tạo content ngắn gọn, rõ ràng và có thể tái sử dụng.
   - Xác định confidence từ 0 đến 1.

3. Nếu đã có preference cùng Ý NGHĨA:
   - Không tạo preference mới.
   - Trả về isDuplicate = true.
   - isConflict = false.
   - Trả về existingPreferenceId là ID của preference tương ứng.

4. Nếu preference mới MÂU THUẪN với một preference đã tồn tại:
   - Không tạo preference mới.
   - Trả về isDuplicate = false.
   - isConflict = true.
   - Trả về existingPreferenceId là ID của preference đang bị mâu thuẫn.
   - Preference cũ sẽ được cập nhật thành preference mới.

5. Nếu chưa có preference tương đương hoặc mâu thuẫn:
   - Trả về isDuplicate = false.
   - isConflict = false.
   - existingPreferenceId = null.

============================================================
JSON OUTPUT
============================================================

Chỉ trả về DUY NHẤT JSON hợp lệ theo cấu trúc:

{
  "shouldCreatePreference": true,
  "isDuplicate": false,
  "isConflict": false,
  "existingPreferenceId": null,
  "type": "notification_preference",
  "content": "Người dùng thích nhận thông báo nhắc nhở về lịch học.",
  "confidence": 0.9
}

============================================================
QUY TẮC
============================================================

- shouldCreatePreference chỉ được là true hoặc false.

- isDuplicate chỉ được là true hoặc false.

- isConflict chỉ được là true hoặc false.

- isDuplicate và isConflict không được đồng thời là true.

- existingPreferenceId là ID của preference đã tồn tại nếu isDuplicate = true
  hoặc isConflict = true.
  Nếu cả isDuplicate và isConflict đều false thì existingPreferenceId phải là null.

- type phải là một trong:
  schedule_preference
  task_preference
  notification_preference
  recommendation_preference
  general_preference

- content phải mô tả preference một cách ngắn gọn, rõ ràng và có thể sử dụng
  trong các lần phân tích PersonalContext sau.

- confidence phải là số từ 0 đến 1.

- Feedback positive có thể cho thấy người dùng đánh giá cao một loại thông tin,
  hành động hoặc recommendation.

- Feedback negative có thể cho thấy người dùng không thích hoặc không muốn
  một loại thông tin, hành động hoặc recommendation.

- Chỉ tạo preference nếu Feedback có khả năng phản ánh sở thích, hành vi hoặc
  quy luật có tính lâu dài.

- Không tạo preference từ một thông tin ngẫu nhiên không phản ánh sở thích,
  hành vi hoặc quy luật của người dùng.

- Khi kiểm tra duplicate, phải dựa trên Ý NGHĨA của preference.

- Hai câu có cách diễn đạt khác nhau nhưng cùng thể hiện một sở thích thì phải
  được xem là duplicate.

Ví dụ:

Preference hiện tại:
"Người dùng thích nhận thông báo nhắc nhở về lịch học."

Preference mới:
"Người dùng thích nhận gợi ý và thông báo nhắc nhở trước các buổi học."

Hai preference trên có cùng ý nghĩa chính về việc người dùng thích nhận
thông báo nhắc nhở liên quan đến lịch học, vì vậy phải trả về:

"isDuplicate": true

- Không xem hai preference là khác nhau chỉ vì câu chữ khác nhau.

- Nếu preference mới thể hiện ý nghĩa trái ngược với preference cũ thì phải
  xem là conflict.

Ví dụ:

Preference hiện tại:
"Người dùng thích nhận thông báo nhắc nhở về lịch học."

Preference mới:
"Người dùng không muốn nhận thông báo nhắc nhở về lịch học."

Hai preference trên mâu thuẫn trực tiếp với nhau, vì vậy phải trả về:

"isDuplicate": false,
"isConflict": true,
"existingPreferenceId": ID của preference hiện tại.

- Khi có conflict, preference mới sẽ thay thế preference cũ.

- Không được tự bịa thông tin ngoài Feedback, AIInsight, PersonalContext và
  các ContextPreference đã cung cấp.

- Nếu không đủ bằng chứng để tạo preference, trả về:

{
  "shouldCreatePreference": false,
  "isDuplicate": false,
  "isConflict": false,
  "existingPreferenceId": null,
  "type": "general_preference",
  "content": null,
  "confidence": 0
}

- Không thêm Markdown.

- Không thêm Markdown code block.

- Chỉ trả về JSON.
`;

  // ============================================================
  // 4. Gọi Gemini
  // ============================================================
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  // ============================================================
  // 5. Parse JSON từ Gemini
  // ============================================================
  let refinement;

  try {
    refinement = JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse Gemini refinement:", text);
    throw new Error("Gemini returned invalid JSON");
  }

  // ============================================================
  // 6. Validate kết quả Gemini
  // ============================================================
  if (typeof refinement.shouldCreatePreference !== "boolean") {
    throw new Error(
      "Invalid Gemini response: shouldCreatePreference must be boolean"
    );
  }

  if (typeof refinement.isDuplicate !== "boolean") {
    throw new Error(
      "Invalid Gemini response: isDuplicate must be boolean"
    );
  }

  if (typeof refinement.isConflict !== "boolean") {
    throw new Error(
      "Invalid Gemini response: isConflict must be boolean"
    );
  }

  if (refinement.isDuplicate && refinement.isConflict) {
    throw new Error(
      "Invalid Gemini response: isDuplicate and isConflict cannot both be true"
    );
  }

  if (
  typeof refinement.confidence !== "number" ||
  refinement.confidence < 0 ||
  refinement.confidence > 1
) {
  throw new Error(
    "Invalid Gemini response: confidence must be a number between 0 and 1"
  );
}

  // ============================================================
  // 7. Không phát hiện preference lâu dài
  // ============================================================
  if (!refinement.shouldCreatePreference) {
    return {
      preferenceCreated: false,
      duplicate: false,
      reason: "No persistent preference detected",
      refinement,
    };
  }

  if (refinement.confidence < 0.7) {
  return {
    preferenceCreated: false,
    preferenceUpdated: false,
    duplicate: false,
    conflict: false,
    reason: "Preference confidence is below threshold",
    refinement,
  };
}

  // ============================================================
  // 8. Kiểm tra dữ liệu preference
  // ============================================================
  if (!refinement.type || !refinement.content) {
    return {
      preferenceCreated: false,
      duplicate: false,
      reason: "Incomplete preference data",
      refinement,
    };
  }

  // ============================================================
  // 9. Nếu Gemini phát hiện duplicate
  // ============================================================
  if (refinement.isDuplicate && refinement.existingPreferenceId) {
    const existingPreference =
      await prisma.contextPreference.findFirst({
        where: {
          id: refinement.existingPreferenceId,
          userId: feedback.userId,
        },
      });

    if (existingPreference) {
      return {
        preferenceCreated: false,
        duplicate: true,
        preference: existingPreference,
        refinement,
      };
    }

    // Gemini trả về ID nhưng ID không tồn tại hoặc không thuộc user.
    // Không tin tưởng ID đó và không tạo duplicate ngay lập tức.
    return {
      preferenceCreated: false,
      duplicate: false,
      reason: "Referenced existing preference was not found",
      refinement,
    };
  }

  // ============================================================
  // 10. Nếu conflict → cập nhật ContextPreference cũ
  // ============================================================
  if (refinement.isConflict && refinement.existingPreferenceId) {
    const existingPreference =
      await prisma.contextPreference.findFirst({
        where: {
          id: refinement.existingPreferenceId,
          userId: feedback.userId,
        },
      });

    if (!existingPreference) {
      return {
        preferenceCreated: false,
        preferenceUpdated: false,
        duplicate: false,
        conflict: false,
        reason: "Referenced conflicting preference was not found",
        refinement,
      };
    }

    const updatedPreference =
      await prisma.contextPreference.update({
        where: {
          id: existingPreference.id,
        },
        data: {
          type: refinement.type,
          content: refinement.content,
          confidence: refinement.confidence ?? null,
        },
      });

    return {
      preferenceCreated: false,
      preferenceUpdated: true,
      duplicate: false,
      conflict: true,
      preference: updatedPreference,
      previousPreference: existingPreference,
      refinement,
    };
  }

  // ============================================================
  // 11. Nếu không duplicate hoặc conflict → tạo preference mới
  // ============================================================
  const preference = await prisma.contextPreference.create({
    data: {
      type: refinement.type,
      content: refinement.content,
      confidence: refinement.confidence ?? null,
      userId: feedback.userId,
    },
  });

  return {
    preferenceCreated: true,
    preferenceUpdated: false,
    duplicate: false,
    conflict: false,
    preference,
    refinement,
  };
}
