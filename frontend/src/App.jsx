import { useEffect, useState } from "react";
import api from "./services/api";

function App() {
  const [message, setMessage] = useState("Đang kết nối Backend...");

  useEffect(() => {
    api
      api.get("/health")
      .then((response) => {
        setMessage(response.data.message);
      })
      .catch((error) => {
        console.error("Backend connection error:", error);
        setMessage("Không thể kết nối Backend");
      });
  }, []);

  return (
    <div>
      <h1>Proactive AI Assistant</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;