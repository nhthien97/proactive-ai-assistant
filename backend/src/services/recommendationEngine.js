import prisma from "../prisma.js";

export async function getRecommendation(insightId) {
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

  if (insight.actionType !== "recommendation") {
    return {
      recommendationAvailable: false,
      actionType: insight.actionType,
      message: "AIInsight does not contain a recommendation action",
    };
  }

  if (!insight.recommendation) {
    return {
      recommendationAvailable: false,
      actionType: "recommendation",
      message: "No recommendation available",
    };
  }

  return {
    recommendationAvailable: true,
    actionType: "recommendation",
    recommendation: insight.recommendation,
    insightId: insight.id,
    contextId: insight.contextId,
  };
}
