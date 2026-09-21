import prisma from "../prisma.js";

export async function assertUserExists(userId) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function assertContextOwnership(contextId, userId) {
  const context = await prisma.personalContext.findFirst({
    where: {
      id: contextId,
      userId,
    },
  });

  if (!context) {
    throw new Error("Context not found or access denied");
  }

  return context;
}

export async function assertSourceOwnership(sourceId, userId) {
  const source = await prisma.source.findFirst({
    where: {
      id: sourceId,
      userId,
    },
  });

  if (!source) {
    throw new Error("Source not found or access denied");
  }

  return source;
}

export async function assertTaskOwnership(taskId, userId) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!task) {
    throw new Error("Task not found or access denied");
  }

  return task;
}

export async function assertNotificationOwnership(
  notificationId,
  userId
) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new Error("Notification not found or access denied");
  }

  return notification;
}

export async function assertAIInsightOwnership(insightId, userId) {
  const insight = await prisma.aIInsight.findFirst({
    where: {
      id: insightId,
      context: {
        userId,
      },
    },
  });

  if (!insight) {
    throw new Error("AIInsight not found or access denied");
  }

  return insight;
}

export async function assertFeedbackOwnership(feedbackId, userId) {
  const feedback = await prisma.feedback.findFirst({
    where: {
      id: feedbackId,
      userId,
    },
  });

  if (!feedback) {
    throw new Error("Feedback not found or access denied");
  }

  return feedback;
}

export async function assertPreferenceOwnership(
  preferenceId,
  userId
) {
  const preference = await prisma.contextPreference.findFirst({
    where: {
      id: preferenceId,
      userId,
    },
  });

  if (!preference) {
    throw new Error("Preference not found or access denied");
  }

  return preference;
}
