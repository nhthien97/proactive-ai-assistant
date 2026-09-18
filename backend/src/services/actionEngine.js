import prisma from "../prisma.js";

export async function processAIInsight(insightId) {
  // 1. Lấy AIInsight và context liên quan
  const insight = await prisma.aIInsight.findUnique({
    where: {
      id: insightId,
    },
    include: {
      context: true,
    },
  });

  if (!insight) {
    throw new Error("AIInsight not found");
  }

  // 2. Nếu AI không yêu cầu action → không làm gì
  if (!insight.needsAction) {
    return {
      actionCreated: false,
      actionType: "none",
      message: "AIInsight does not require an action",
    };
  }

  // 3. Xử lý theo actionType
  if (insight.actionType === "task") {
    // Kiểm tra task đã được tạo từ AIInsight này chưa
    const existingTask = await prisma.task.findFirst({
      where: {
        aiInsightId: insight.id,
      },
    });

    if (existingTask) {
      return {
        actionCreated: false,
        actionType: "task",
        duplicate: true,
        action: existingTask,
      };
    }

    // suggestedTask được Gemini trả về
    const suggestedTask = insight.suggestedTask;

    if (!suggestedTask) {
      return {
        actionCreated: false,
        actionType: "task",
        message: "No suggested task data",
      };
    }

    const task = await prisma.task.create({
      data: {
        title: suggestedTask.title || insight.summary,
        description: suggestedTask.description || null,
        priority: suggestedTask.priority || "medium",
        dueDate: suggestedTask.dueDate
          ? new Date(suggestedTask.dueDate)
          : null,
        userId: insight.context.userId,
        contextId: insight.contextId,
        aiInsightId: insight.id,
      },
    });

    return {
      actionCreated: true,
      actionType: "task",
      action: task,
    };
  }

  if (insight.actionType === "notification") {
    // Kiểm tra notification đã được tạo từ AIInsight này chưa
    const existingNotification = await prisma.notification.findFirst({
      where: {
        aiInsightId: insight.id,
      },
    });

    if (existingNotification) {
      return {
        actionCreated: false,
        actionType: "notification",
        duplicate: true,
        action: existingNotification,
      };
    }

    const notification = await prisma.notification.create({
      data: {
        title: insight.summary,
        message:
          insight.recommendation ||
          "Có một thông tin mới cần bạn chú ý.",
        type: "ai_insight",
        userId: insight.context.userId,
        aiInsightId: insight.id,
      },
    });

    return {
      actionCreated: true,
      actionType: "notification",
      action: notification,
    };
  }

  if (insight.actionType === "recommendation") {
    return {
      actionCreated: false,
      actionType: "recommendation",
      message:
        insight.recommendation ||
        "AIInsight contains a recommendation",
    };
  }

  if (insight.actionType === "none") {
    return {
      actionCreated: false,
      actionType: "none",
      message: "No action required",
    };
  }

  return {
    actionCreated: false,
    actionType: insight.actionType,
    message: "Unsupported action type",
  };
}