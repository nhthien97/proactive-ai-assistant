import prisma from "../prisma.js";
import { analyzeContext } from "./aiAnalysisService.js";
import { processAIInsight } from "./actionEngine.js";

let isRunning = false;

async function checkTaskDeadlines() {
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      status: {
        not: "completed",
      },
      dueDate: {
        not: null,
      },
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  if (tasks.length === 0) {
    console.log("[Scheduler] No tasks with deadlines.");
    return;
  }

  for (const task of tasks) {
    if (!task.dueDate) continue;

    if (task.dueDate <= now) {
      const existingNotification = await prisma.notification.findFirst({
        where: {
          taskId: task.id,
          type: "deadline",
        },
      });

      if (existingNotification) {
        continue;
      }

      await prisma.notification.create({
        data: {
          title: "Task đã đến hạn",
          message: `Công việc "${task.title}" đã đến hạn.`,
          type: "deadline",
          userId: task.userId,
          taskId: task.id,
          aiInsightId: task.aiInsightId,
        },
      });

      console.log(
        `[Scheduler] Deadline notification created for task ${task.id}.`
      );
    }
  }
}

export async function runProactiveScheduler() {
  if (isRunning) {
    console.log("[Scheduler] Previous run is still processing.");
    return;
  }

  isRunning = true;

  try {
    const contexts = await prisma.personalContext.findMany({
      where: {
        aiInsights: {
          none: {},
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (contexts.length === 0) {
      console.log("[Scheduler] No unprocessed contexts.");
      await checkTaskDeadlines();
      return;
    }

    console.log(
      `[Scheduler] Found ${contexts.length} unprocessed context(s).`
    );

    for (const context of contexts) {
      try {
        console.log(
          `[Scheduler] Processing context ${context.id}...`
        );

        const insight = await analyzeContext(context.id);
        const actionResult = await processAIInsight(insight.id);

        console.log(
          `[Scheduler] Completed context ${context.id}:`,
          actionResult.actionType
        );
      } catch (error) {
        console.error(
          `[Scheduler] Failed to process context ${context.id}:`,
          error.message
        );
      }
    }

    await checkTaskDeadlines();
  } catch (error) {
    console.error("[Scheduler] Scheduler error:", error.message);
  } finally {
    isRunning = false;
  }
}
