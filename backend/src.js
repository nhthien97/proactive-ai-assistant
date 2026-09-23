import express from "express";
import crypto from "node:crypto";
import cors from "cors";
import prisma from "./src/prisma.js";

import "dotenv/config";
import { processAIInsight } from "./src/services/actionEngine.js";
import { getRecommendation } from "./src/services/recommendationEngine.js";
import { analyzeContext } from "./src/services/aiAnalysisService.js";
import { runProactiveScheduler } from "./src/services/proactiveScheduler.js";
import { generateDailyBriefing } from "./src/services/dailyBriefingService.js";
import { getFeedbackWithContext } from "./src/services/feedbackService.js";
import { refineContextPreference } from "./src/services/feedbackRefinementService.js";
import {
  getGoogleAuthorizationUrl,
  exchangeGoogleCode,
  getGoogleUserInfo,
} from "./src/services/googleOAuthService.js";
import {
  assertUserExists,
  assertContextOwnership,
  assertSourceOwnership,
  assertTaskOwnership,
  assertNotificationOwnership,
  assertAIInsightOwnership,
  assertFeedbackOwnership,
  assertPreferenceOwnership,
} from "./src/utils/ownership.js";

const app = express();
const PORT = 5000;

const oauthStates = new Map();

function createOAuthState() {
  const state = crypto.randomBytes(32).toString("hex");

  oauthStates.set(state, {
    createdAt: Date.now(),
  });

  return state;
}

function consumeOAuthState(state) {
  if (!state) {
    return false;
  }

  const record = oauthStates.get(state);

  if (!record) {
    return false;
  }

  oauthStates.delete(state);

  const maxAge = 10 * 60 * 1000;

  if (Date.now() - record.createdAt > maxAge) {
    return false;
  }

  return true;
}


app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    message: "Proactive AI Assistant Backend is running!",
  });
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany();

    res.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);

    res.status(500).json({
      message: "Failed to fetch users",
    });
  }
});


app.post("/api/users", async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Failed to create user:", error);

    res.status(500).json({
      message: "Failed to create user",
    });
  }
});

app.get("/api/contexts", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    await assertUserExists(userId);

    const contexts = await prisma.personalContext.findMany({
      where: {
        userId,
      },
      include: {
        source: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(contexts);
  } catch (error) {
    console.error("Failed to fetch contexts:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(500).json({
      message: "Failed to fetch contexts",
      details: error.message,
    });
  }
});

app.post("/api/contexts", async (req, res) => {
  try {
    const { type, content, importance, userId, sourceId } = req.body;

    if (!type || !content || !userId) {
      return res.status(400).json({
        message: "type, content and userId are required",
      });
    }

    await assertUserExists(userId);

    if (sourceId) {
      await assertSourceOwnership(sourceId, userId);
    }

    const context = await prisma.personalContext.create({
      data: {
        type,
        content,
        importance: importance ?? 1,
        userId,
        sourceId: sourceId ?? null,
      },
    });

    const insight = await analyzeContext(context.id);

    const actionResult = await processAIInsight(insight.id);

    return res.status(201).json({
      context,
      insight,
      action: actionResult,
    });
  } catch (error) {
    console.error("Proactive context processing error:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (error.message === "Source not found or access denied") {
      return res.status(403).json({
        message: "Source does not belong to this user",
      });
    }

    return res.status(500).json({
      message: "Failed to create and process context",
      details: error.message,
    });
  }
});

app.post("/api/sources", async (req, res) => {
  try {
    const { type, name, userId } = req.body;

    if (!type || !name || !userId) {
      return res.status(400).json({
        message: "type, name and userId are required",
      });
    }

    await assertUserExists(userId);

    const source = await prisma.source.create({
      data: {
        type,
        name,
        userId,
      },
    });

    res.status(201).json(source);
  } catch (error) {
    console.error("Failed to create source:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(500).json({
      message: "Failed to create source",
      details: error.message,
    });
  }
});

app.get("/api/sources", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    await assertUserExists(userId);

    const sources = await prisma.source.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(sources);
  } catch (error) {
    console.error("Failed to fetch sources:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(500).json({
      message: "Failed to fetch sources",
      details: error.message,
    });
  }
});

app.put("/api/contexts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceId, userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    await assertContextOwnership(id, userId);

    if (sourceId) {
      await assertSourceOwnership(sourceId, userId);
    }

    const context = await prisma.personalContext.update({
      where: {
        id,
      },
      data: {
        sourceId: sourceId ?? null,
      },
      include: {
        source: true,
      },
    });

    res.json(context);
  } catch (error) {
    console.error("Failed to update context:", error);

    if (error.message === "Context not found or access denied") {
      return res.status(403).json({
        message: "Context does not belong to this user",
      });
    }

    if (error.message === "Source not found or access denied") {
      return res.status(403).json({
        message: "Source does not belong to this user",
      });
    }

    res.status(500).json({
      message: "Failed to update context",
      details: error.message,
    });
  }
});

app.get("/api/tasks", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    await assertUserExists(userId);

    const tasks = await prisma.task.findMany({
      where: {
        userId,
      },
      include: {
        context: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(tasks);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(500).json({
      message: "Failed to fetch tasks",
      details: error.message,
    });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      userId,
      contextId,
    } = req.body;

    if (!title || !userId) {
      return res.status(400).json({
        message: "title and userId are required",
      });
    }

    await assertUserExists(userId);

if (contextId) {
  await assertContextOwnership(contextId, userId);
}

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status ?? "pending",
        priority: priority ?? "medium",
        dueDate: dueDate ? new Date(dueDate) : null,
        userId,
        contextId,
      },
      include: {
        context: true,
      },
    });

    res.status(201).json(task);
  } catch (error) {
  console.error("Failed to create task:", error);

  if (error.message === "User not found") {
    return res.status(404).json({
      message: "User not found",
    });
  }

  if (error.message === "Context not found or access denied") {
    return res.status(403).json({
      message: "Context does not belong to this user",
    });
  }

  res.status(500).json({
    message: "Failed to create task",
    details: error.message,
  });
}
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, userId } = req.body;
    if (!userId) {
  return res.status(400).json({
    message: "userId is required",
  });
}

await assertTaskOwnership(id, userId);

    const task = await prisma.task.update({
      where: {
        id,
      },
      data: {
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
      },
      include: {
        context: true,
      },
    });

    res.json(task);
  } catch (error) {
  console.error("Failed to update task:", error);

  if (error.message === "Task not found or access denied") {
    return res.status(403).json({
      message: "Task does not belong to this user",
    });
  }

  res.status(500).json({
    message: "Failed to update task",
    details: error.message,
  });
}
});


app.get("/api/notifications", async (req, res) => {
  try {
    const { userId } = req.query;

if (!userId) {
  return res.status(400).json({
    message: "userId is required",
  });
}

await assertUserExists(userId);

    const notifications = await prisma.notification.findMany({
  where: {
    userId,
  },
  include: {
    task: true,
  },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(notifications);
  } catch (error) {
    console.error("Failed to fetch notifications:", error);

    if (error.message === "User not found") {
  return res.status(404).json({
    message: "User not found",
  });
}

    res.status(500).json({
      message: "Failed to fetch notifications",
    });
  }
});

app.post("/api/notifications", async (req, res) => {
  try {
    const { title, message, type, userId, taskId } = req.body;

    if (!title || !message || !type || !userId) {
      return res.status(400).json({
        message: "title, message, type and userId are required",
      });
    }

    await assertUserExists(userId);

if (taskId) {
  await assertTaskOwnership(taskId, userId);
}

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        userId,
        taskId,
      },
      include: {
        task: true,
      },
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error("Failed to create notification:", error);

    if (error.message === "User not found") {
  return res.status(404).json({
    message: "User not found",
  });
}

if (error.message === "Task not found or access denied") {
  return res.status(403).json({
    message: "Task does not belong to this user",
  });
}

    res.status(500).json({
      message: "Failed to create notification",
    });
  }
});


app.put("/api/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
const { isRead, userId } = req.body;

if (!userId) {
  return res.status(400).json({
    message: "userId is required",
  });
}

await assertNotificationOwnership(id, userId);

    const notification = await prisma.notification.update({
      where: {
        id,
      },
      data: {
        isRead: isRead ?? true,
      },
      include: {
        task: true,
      },
    });

    res.json(notification);
  } catch (error) {
    console.error("Failed to update notification:", error);

    if (error.message === "Notification not found or access denied") {
  return res.status(403).json({
    message: "Notification does not belong to this user",
  });
}

    res.status(500).json({
      message: "Failed to update notification",
    });
  }
});


// =========================
// AI INSIGHTS
// =========================
app.get("/api/ai/insights", async (req, res) => {
  try {
    const { userId } = req.query;

if (!userId) {
  return res.status(400).json({
    message: "userId is required",
  });
}

await assertUserExists(userId);
    const insights = await prisma.aIInsight.findMany({
  where: {
    context: {
      userId,
    },
  },
  include: {
        context: {
          include: {
            source: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(insights);
  } catch (error) {
    console.error("Failed to fetch AI insights:", error);

    if (error.message === "User not found") {
  return res.status(404).json({
    message: "User not found",
  });
}

    res.status(500).json({
      message: "Failed to fetch AI insights",
    });
  }
});

// =========================
// AI ANALYSIS
// =========================
app.post("/api/ai/analyze-context", async (req, res) => {
  try {
    const { contextId, userId } = req.body;

    if (!contextId) {
      return res.status(400).json({
        error: "contextId is required",
      });
    }

    if (!userId) {
  return res.status(400).json({
    error: "userId is required",
  });
}

await assertUserExists(userId);
await assertContextOwnership(contextId, userId);

    const insight = await analyzeContext(contextId);

    return res.status(201).json({
      insight,
    });
  } catch (error) {

    if (error.message === "Context not found or access denied") {
  return res.status(403).json({
    error: "Context does not belong to this user",
  });
}
    console.error("AI analysis error:", error);

    if (error.message === "Context not found") {
      return res.status(404).json({
        error: "Context not found",
      });
    }

    return res.status(500).json({
      error: "Failed to analyze context",
      details: error.message,
    });
  }
});

// =========================
// PROACTIVE ACTION ENGINE
// =========================
app.post("/api/ai/process-insight", async (req, res) => {
  try {
    const { insightId, userId } = req.body;

    if (!insightId) {
      return res.status(400).json({
        error: "insightId is required",
      });
    }

    if (!userId) {
  return res.status(400).json({
    error: "userId is required",
  });
}

await assertUserExists(userId);
await assertAIInsightOwnership(insightId, userId);

    const result = await processAIInsight(insightId);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Action Engine error:", error);

    if (error.message === "AIInsight not found or access denied") {
  return res.status(403).json({
    error: "AIInsight does not belong to this user",
  });
}

    return res.status(500).json({
      error: "Failed to process AIInsight",
      details: error.message,
    });
  }
});

// =========================
// RECOMMENDATION ENGINE
// =========================
app.post("/api/ai/recommendation", async (req, res) => {
  try {
    const { insightId, userId } = req.body;

    if (!insightId) {
      return res.status(400).json({
        error: "insightId is required",
      });
    }

    if (!userId) {
  return res.status(400).json({
    error: "userId is required",
  });
}

await assertUserExists(userId);
await assertAIInsightOwnership(insightId, userId);

    const result = await getRecommendation(insightId);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Recommendation Engine error:", error);

    if (error.message === "AIInsight not found or access denied") {
  return res.status(403).json({
    error: "AIInsight does not belong to this user",
  });
}

    return res.status(500).json({
      error: "Failed to get recommendation",
      details: error.message,
    });
  }
});


app.get("/api/daily-briefing", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    await assertUserExists(userId);

    const result = await generateDailyBriefing(userId);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Daily Briefing error:", error);

    if (error.message === "User not found") {
  return res.status(404).json({
    message: "User not found",
  });
}

    return res.status(500).json({
      message: "Failed to generate Daily Briefing",
      details: error.message,
    });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const { userId, aiInsightId, type, comment } = req.body;

    if (!userId || !aiInsightId || !type) {
      return res.status(400).json({
        message: "userId, aiInsightId and type are required",
      });
    }

    if (!["positive", "negative"].includes(type)) {
      return res.status(400).json({
        message: "type must be positive or negative",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await assertAIInsightOwnership(aiInsightId, userId);

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        aiInsightId,
        type,
        comment: comment || null,
      },
    });

    return res.status(201).json(feedback);
  } catch (error) {
    console.error("Create Feedback error:", error);

    if (error.message === "AIInsight not found or access denied") {
  return res.status(403).json({
    message: "AIInsight does not belong to this user",
  });
}

    return res.status(500).json({
      message: "Failed to create feedback",
      details: error.message,
    });
  }
});

app.get("/api/feedback", async (req, res) => {
  try {
    const { userId, aiInsightId } = req.query;

if (!userId) {
  return res.status(400).json({
    message: "userId is required",
  });
}

await assertUserExists(userId);

    const where = {
  userId,
};

if (aiInsightId) {
  where.aiInsightId = aiInsightId;
}

    const feedbacks = await prisma.feedback.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(feedbacks);
  } catch (error) {
    console.error("Get Feedback error:", error);

    if (error.message === "User not found") {
  return res.status(404).json({
    message: "User not found",
  });
}

    return res.status(500).json({
      message: "Failed to get feedback",
      details: error.message,
    });
  }
});

app.get("/api/feedback/:id/context", async (req, res) => {
  try {
    const { id } = req.params;
const { userId } = req.query;

if (!userId) {
  return res.status(400).json({
    message: "userId is required",
  });
}

await assertUserExists(userId);
await assertFeedbackOwnership(id, userId);

    const result = await getFeedbackWithContext(id);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get Feedback Context error:", error);

    if (error.message === "Feedback not found or access denied") {
  return res.status(403).json({
    message: "Feedback does not belong to this user",
  });
}

if (error.message === "User not found") {
  return res.status(404).json({
    message: "User not found",
  });
}

    if (error.message === "Feedback not found") {
      return res.status(404).json({
        message: "Feedback not found",
      });
    }

    return res.status(500).json({
      message: "Failed to get feedback context",
      details: error.message,
    });
  }
});


app.post("/api/feedback/:id/refine", async (req, res) => {
  try {
    const { id } = req.params;
const { userId } = req.body;

if (!userId) {
  return res.status(400).json({
    message: "userId is required",
  });
}

await assertUserExists(userId);
await assertFeedbackOwnership(id, userId);

    const result = await refineContextPreference(id);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Refine Feedback error:", error);

    if (error.message === "Feedback not found or access denied") {
  return res.status(403).json({
    message: "Feedback does not belong to this user",
  });
}

if (error.message === "User not found") {
  return res.status(404).json({
    message: "User not found",
  });
}

    if (error.message === "Feedback not found") {
      return res.status(404).json({
        message: "Feedback not found",
      });
    }

    return res.status(500).json({
      message: "Failed to refine feedback",
      details: error.message,
    });
  }
});


// ============================================================
// Context Preference API
// ============================================================

app.get("/api/preferences", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const preferences = await prisma.contextPreference.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (error.message === "Preference not found or access denied") {
  return res.status(403).json({
    message: "Preference does not belong to this user",
  });
}

    return res.status(200).json(preferences);
  } catch (error) {
    console.error("Get Preferences error:", error);

if (error.message === "User not found") {
  return res.status(404).json({
    message: "User not found",
  });
}

    return res.status(500).json({
      message: "Failed to get preferences",
      details: error.message,
    });
  }
});

app.get("/api/preferences/:id", async (req, res) => {
  try {
    const { id } = req.params;
const { userId } = req.query;

if (!userId) {
  return res.status(400).json({
    message: "userId is required",
  });
}

await assertUserExists(userId);

await assertPreferenceOwnership(id, userId);

return res.status(200).json(
  await prisma.contextPreference.findUnique({
    where: {
      id,
    },
  })
);
  } catch (error) {
    console.error("Get Preference error:", error);

    if (error.message === "Preference not found or access denied") {
  return res.status(403).json({
    message: "Preference does not belong to this user",
  });
}

if (error.message === "User not found") {
  return res.status(404).json({
    message: "User not found",
  });
}

    return res.status(500).json({
      message: "Failed to get preference",
      details: error.message,
    });
  }
});



app.get("/api/auth/google", (req, res) => {
  try {
    const state = createOAuthState();

    const authorizationUrl = getGoogleAuthorizationUrl(state);

    return res.redirect(authorizationUrl);
  } catch (error) {
    console.error("Google OAuth start error:", error);

    return res.status(500).json({
      message: "Failed to start Google OAuth",
      details: error.message,
    });
  }
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).json({
        message: "Google OAuth was denied or cancelled",
        error,
      });
    }

    if (!consumeOAuthState(state)) {
      return res.status(400).json({
        message: "Invalid or expired OAuth state",
      });
    }

    if (!code) {
      return res.status(400).json({
        message: "Google authorization code is required",
      });
    }

    const { tokens, oauth2Client } = await exchangeGoogleCode(code);

    oauth2Client.setCredentials(tokens);

    const googleUser = await getGoogleUserInfo(oauth2Client);

if (!googleUser.id || !googleUser.email) {
  return res.status(400).json({
    message: "Google account information is incomplete",
  });
}

// 1. Create or update the application user
const user = await prisma.user.upsert({
  where: {
    email: googleUser.email,
  },
  update: {
    name: googleUser.name ?? undefined,
  },
  create: {
    email: googleUser.email,
    name: googleUser.name ?? null,
  },
});

// 2. Find existing Gmail connection by stable Google subject
const existingConnection = await prisma.gmailConnection.findUnique({
  where: {
    googleSubject: googleUser.id,
  },
});

// 3. Create or update Gmail connection
const gmailConnection = existingConnection
  ? await prisma.gmailConnection.update({
      where: {
        id: existingConnection.id,
      },
      data: {
        googleEmail: googleUser.email,
        accessToken: tokens.access_token ?? null,
        refreshToken:
          tokens.refresh_token ?? existingConnection.refreshToken,
        scope: tokens.scope ?? existingConnection.scope,
        tokenType: tokens.token_type ?? existingConnection.tokenType,
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : existingConnection.expiryDate,
        userId: user.id,
      },
    })
  : await prisma.gmailConnection.create({
      data: {
        googleSubject: googleUser.id,
        googleEmail: googleUser.email,
        accessToken: tokens.access_token ?? null,
        refreshToken: tokens.refresh_token ?? null,
        scope: tokens.scope ?? null,
        tokenType: tokens.token_type ?? null,
        expiryDate: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        userId: user.id,
      },
    });

    return res.status(200).json({
  message: "Google OAuth successful",
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
  },
  gmailConnection: {
    id: gmailConnection.id,
    googleEmail: gmailConnection.googleEmail,
    scope: gmailConnection.scope,
    tokenType: gmailConnection.tokenType,
    expiryDate: gmailConnection.expiryDate,
  },
  googleUser: {
    id: googleUser.id,
    email: googleUser.email,
    name: googleUser.name,
    picture: googleUser.picture,
  },
  tokenInfo: {
    hasAccessToken: Boolean(tokens.access_token),
    hasRefreshToken: Boolean(tokens.refresh_token),
    scope: tokens.scope ?? null,
    tokenType: tokens.token_type ?? null,
    expiryDate: tokens.expiry_date ?? null,
  },
});
  } catch (error) {
    console.error("Google OAuth callback error:", error);

    return res.status(500).json({
      message: "Google OAuth callback failed",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);

  // Run once when backend starts
  runProactiveScheduler();

  // Run every 60 seconds
  setInterval(() => {
    runProactiveScheduler();
  }, 60 * 1000);
});