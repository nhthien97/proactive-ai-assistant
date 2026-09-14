import { useEffect, useState } from "react";
import api from "./services/api";
import "./App.css";

function App() {
  const [message, setMessage] = useState("Đang kết nối Backend...");
  const [users, setUsers] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sources, setSources] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    contextId: "",
  });

  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          healthResponse,
          usersResponse,
          contextsResponse,
          tasksResponse,
          notificationsResponse,
          sourcesResponse,
          aiInsightsResponse,
        ] = await Promise.all([
          api.get("/health"),
          api.get("/users"),
          api.get("/contexts"),
          api.get("/tasks"),
          api.get("/notifications"),
          api.get("/sources"),
          api.get("/ai/insights"),
        ]);

        setMessage(healthResponse.data.message);
        setUsers(usersResponse.data);
        setContexts(contextsResponse.data);
        setTasks(tasksResponse.data);
        setNotifications(notificationsResponse.data);
        setSources(sourcesResponse.data);
        setAiInsights(aiInsightsResponse.data);
      } catch (error) {
        console.error("Failed to load data:", error);
        setMessage("Không thể tải dữ liệu từ Backend");
      }
    };

    loadData();
  }, []);

  const user = users[0];

  const pendingTasks = tasks.filter(
    (task) => task.status !== "completed",
  ).length;

  const completedTasks = tasks.filter(
    (task) => task.status === "completed",
  ).length;

  const unreadNotifications = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const handleTaskStatusChange = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";

    try {
      const response = await api.put(`/tasks/${task.id}`, {
        status: newStatus,
      });

      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id ? response.data : currentTask,
        ),
      );
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleNotificationRead = async (notification) => {
    try {
      const response = await api.put(`/notifications/${notification.id}`, {
        isRead: true,
      });

      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) =>
          currentNotification.id === notification.id
            ? response.data
            : currentNotification,
        ),
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();

    if (!newTask.title.trim() || !user?.id) {
      return;
    }

    try {
      setCreatingTask(true);
      setTaskError("");

      const response = await api.post("/tasks", {
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        dueDate: newTask.dueDate || undefined,
        userId: user.id,
        contextId: newTask.contextId || undefined,
      });

      setTasks((currentTasks) => [...currentTasks, response.data]);

      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        contextId: "",
      });
    } catch (error) {
      console.error("Failed to create task:", error);
      setTaskError("Không thể tạo công việc");
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <div className="app">
      <main className="main">
        <section className="content">
          {/* TIÊU ĐỀ */}
          <div className="welcome">
            <div className="date-label">
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </div>

            <h1>
              {user?.name ? `Xin chào, ${user.name}` : "Trợ lý AI chủ động"}
            </h1>

            <p className="welcome-text">{message}</p>
          </div>

          {/* THỐNG KÊ */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Bối cảnh</div>

              <div className="stat-value">{contexts.length}</div>

              <div className="stat-description">Personal Context</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Công việc</div>

              <div className="stat-value">{tasks.length}</div>

              <div className="stat-description">Tổng số công việc</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Chưa hoàn thành</div>

              <div className="stat-value">{pendingTasks}</div>

              <div className="stat-description">Công việc chưa hoàn thành</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Hoàn thành</div>

              <div className="stat-value">{completedTasks}</div>

              <div className="stat-description">Công việc đã hoàn thành</div>
            </div>
          </div>

          <section className="panel">
            <div className="panel-header">
              <div className="panel-title">Tạo công việc</div>

              <div className="panel-subtitle">
                Tạo Task mới và lưu trực tiếp vào hệ thống
              </div>
            </div>

            <form
              onSubmit={handleCreateTask}
              style={{
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <input
                type="text"
                placeholder="Tên công việc"
                value={newTask.title}
                onChange={(event) =>
                  setNewTask({
                    ...newTask,
                    title: event.target.value,
                  })
                }
                required
                style={{
                  padding: "12px",
                  fontSize: "16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                }}
              />

              <textarea
                placeholder="Mô tả công việc"
                value={newTask.description}
                onChange={(event) =>
                  setNewTask({
                    ...newTask,
                    description: event.target.value,
                  })
                }
                rows="3"
                style={{
                  padding: "12px",
                  fontSize: "16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  resize: "vertical",
                }}
              />

              <select
                value={newTask.priority}
                onChange={(event) =>
                  setNewTask({
                    ...newTask,
                    priority: event.target.value,
                  })
                }
                style={{
                  padding: "12px",
                  fontSize: "16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  background: "#ffffff",
                }}
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
              </select>

              <input
                type="datetime-local"
                value={newTask.dueDate}
                onChange={(event) =>
                  setNewTask({
                    ...newTask,
                    dueDate: event.target.value,
                  })
                }
                style={{
                  padding: "12px",
                  fontSize: "16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                }}
              />

              {contexts.length > 0 && (
                <select
                  value={newTask.contextId}
                  onChange={(event) =>
                    setNewTask({
                      ...newTask,
                      contextId: event.target.value,
                    })
                  }
                  style={{
                    padding: "12px",
                    fontSize: "16px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    background: "#ffffff",
                  }}
                >
                  <option value="">Không liên kết bối cảnh</option>

                  {contexts.map((context) => (
                    <option key={context.id} value={context.id}>
                      {context.content}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="submit"
                disabled={creatingTask}
                style={{
                  width: "fit-content",
                  padding: "12px 18px",
                  border: "1px solid #111111",
                  borderRadius: "6px",
                  background: "#111111",
                  color: "#ffffff",
                  fontSize: "16px",
                  cursor: creatingTask ? "not-allowed" : "pointer",
                  opacity: creatingTask ? 0.6 : 1,
                }}
              >
                {creatingTask ? "Đang tạo..." : "Tạo công việc"}
              </button>

              {taskError && (
                <div
                  style={{
                    color: "#b91c1c",
                    fontSize: "14px",
                  }}
                >
                  {taskError}
                </div>
              )}
            </form>
          </section>

          <div className="dashboard-grid">
            {/* BỐI CẢNH */}
            {contexts.length > 0 && (
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">Bối cảnh cá nhân</div>

                  <div className="panel-subtitle">
                    Dữ liệu thực tế từ hệ thống
                  </div>
                </div>

                <div className="insights-list">
                  {contexts.map((context) => (
                    <div className="insight-item" key={context.id}>
                      <div className="insight-row">
                        <div className="insight-icon">{context.type}</div>

                        <div className="insight-info">
                          <div className="insight-title">{context.type}</div>

                          <div className="insight-description">
                            {context.content}
                          </div>

                          <div className="insight-description">
                            Mức độ quan trọng: {context.importance}
                          </div>

                          {context.source && (
                            <div className="insight-description">
                              Nguồn: {context.source.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* AI INSIGHTS */}
            {aiInsights.length > 0 && (
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">AI Insights</div>

                  <div className="panel-subtitle">
                    Phân tích chủ động từ Personal Context
                  </div>
                </div>

                <div className="insights-list">
                  {aiInsights.map((insight) => (
                    <div className="insight-item" key={insight.id}>
                      <div className="insight-row">
                        <div className="insight-icon">AI</div>

                        <div className="insight-info">
                          <div className="insight-title">{insight.summary}</div>

                          <div className="insight-description">
                            Loại phân tích: {insight.category}
                          </div>

                          <div className="insight-description">
                            Mức độ quan trọng: {insight.importance}/5
                          </div>

                          <div className="insight-description">
                            Cần hành động:{" "}
                            {insight.needsAction ? "Có" : "Không"}
                          </div>

                          {insight.recommendation && (
                            <div className="insight-description">
                              Đề xuất: {insight.recommendation}
                            </div>
                          )}

                          {insight.risk && (
                            <div className="insight-description">
                              Rủi ro: {insight.risk}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TASK */}
            {tasks.length > 0 && (
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">Công việc</div>

                  <div className="panel-subtitle">
                    Dữ liệu thực tế từ hệ thống
                  </div>
                </div>

                <div className="tasks-list">
                  {tasks.map((task) => (
                    <div className="task-item" key={task.id}>
                      <div className="task-row">
                        <button
                          type="button"
                          className="task-checkbox"
                          onClick={() => handleTaskStatusChange(task)}
                        >
                          {task.status === "completed" ? "✓" : ""}
                        </button>

                        <div className="task-info">
                          <div className="task-title">{task.title}</div>

                          {task.description && (
                            <div className="task-due">{task.description}</div>
                          )}

                          <div className="task-due">
                            Trạng thái:{" "}
                            {task.status === "completed"
                              ? "Đã hoàn thành"
                              : task.status === "pending"
                                ? "Đang chờ xử lý"
                                : task.status}
                          </div>
                        </div>

                        <span className="task-priority">
                          {task.priority === "high"
                            ? "Cao"
                            : task.priority === "medium"
                              ? "Trung bình"
                              : task.priority === "low"
                                ? "Thấp"
                                : task.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* THÔNG BÁO */}
            {notifications.length > 0 && (
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">Thông báo</div>

                  <div className="panel-subtitle">
                    {unreadNotifications > 0
                      ? `${unreadNotifications} thông báo chưa đọc`
                      : "Không có thông báo chưa đọc"}
                  </div>
                </div>

                <div className="insights-list">
                  {notifications.map((notification) => (
                    <div className="insight-item" key={notification.id}>
                      <div className="insight-row">
                        <div className="insight-icon">!</div>

                        <div className="insight-info">
                          <div className="insight-title">
                            {notification.title}
                          </div>

                          <div className="insight-description">
                            {notification.message}
                          </div>

                          <div className="insight-description">
                            Loại: {notification.type}
                          </div>

                          <div className="insight-description">
                            Trạng thái:{" "}
                            {notification.isRead ? "Đã đọc" : "Chưa đọc"}
                          </div>

                          {!notification.isRead && (
                            <button
                              type="button"
                              className="notification-read-button"
                              onClick={() =>
                                handleNotificationRead(notification)
                              }
                            >
                              Đánh dấu đã đọc
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* NGUỒN */}
            {sources.length > 0 && (
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">Nguồn dữ liệu</div>

                  <div className="panel-subtitle">
                    Nguồn đang kết nối với hệ thống
                  </div>
                </div>

                <div className="insights-list">
                  {sources.map((source) => (
                    <div className="insight-item" key={source.id}>
                      <div className="insight-row">
                        <div className="insight-icon">◉</div>

                        <div className="insight-info">
                          <div className="insight-title">{source.name}</div>

                          <div className="insight-description">
                            Loại nguồn: {source.type}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
