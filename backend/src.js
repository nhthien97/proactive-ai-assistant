import express from "express";
import cors from "cors";
import prisma from "./src/prisma.js";

const app = express();
const PORT = 5000;

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
    const contexts = await prisma.personalContext.findMany({
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

    res.status(500).json({
      message: "Failed to fetch contexts",
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

    const context = await prisma.personalContext.create({
      data: {
        type,
        content,
        importance: importance ?? 1,
        userId,
        sourceId,
      },
    });

    res.status(201).json(context);
  } catch (error) {
    console.error("Failed to create context:", error);

    res.status(500).json({
      message: "Failed to create context",
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

    res.status(500).json({
      message: "Failed to create source",
    });
  }
});

app.get("/api/sources", async (req, res) => {
  try {
    const sources = await prisma.source.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(sources);
  } catch (error) {
    console.error("Failed to fetch sources:", error);

    res.status(500).json({
      message: "Failed to fetch sources",
    });
  }
});

app.put("/api/contexts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceId } = req.body;

    const context = await prisma.personalContext.update({
      where: {
        id,
      },
      data: {
        sourceId,
      },
      include: {
        source: true,
      },
    });

    res.json(context);
  } catch (error) {
    console.error("Failed to update context:", error);

    res.status(500).json({
      message: "Failed to update context",
    });
  }
});

app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
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

    res.status(500).json({
      message: "Failed to fetch tasks",
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

    res.status(500).json({
      message: "Failed to create task",
    });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

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

    res.status(500).json({
      message: "Failed to update task",
    });
  }
});


app.get("/api/notifications", async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
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

    res.status(500).json({
      message: "Failed to create notification",
    });
  }
});


app.put("/api/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

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

    res.status(500).json({
      message: "Failed to update notification",
    });
  }
});


app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
