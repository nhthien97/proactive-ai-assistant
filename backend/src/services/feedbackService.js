import prisma from "../prisma.js";

export async function getFeedbackWithContext(feedbackId) {
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

  return {
    feedback: {
      id: feedback.id,
      type: feedback.type,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
    },

    aiInsight: {
      id: feedback.aiInsight.id,
      summary: feedback.aiInsight.summary,
      category: feedback.aiInsight.category,
      importance: feedback.aiInsight.importance,
      confidence: feedback.aiInsight.confidence,
      needsAction: feedback.aiInsight.needsAction,
      actionType: feedback.aiInsight.actionType,
      recommendation: feedback.aiInsight.recommendation,
    },

    context: {
      id: feedback.aiInsight.context.id,
      type: feedback.aiInsight.context.type,
      content: feedback.aiInsight.context.content,
      importance: feedback.aiInsight.context.importance,
    },

    user: {
      id: feedback.user.id,
      name: feedback.user.name,
    },
  };
}
