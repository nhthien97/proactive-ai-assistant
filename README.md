# proactive-ai-assistant
Trợ lý AI cá nhân chủ động dựa trên ngữ cảnh người dùng, hỗ trợ phát hiện công việc, rủi ro và đưa ra đề xuất phù hợp.

1. Khởi tạo mã nguồn
Tạo GitHub Repository: proactive-ai-assistant.
Tạo và sử dụng GitHub Codespaces để phát triển dự án.
Khởi tạo cấu trúc:
frontend/
backend/
docs/
2. Xây dựng Frontend
Công nghệ: React + Vite + JavaScript.
Khởi tạo React:
npm create vite@latest . -- --template react
Cài đặt thư viện:
npm install
npm install axios
Sử dụng Axios để gọi API từ Frontend.
3. Xây dựng Backend
Công nghệ: Node.js + Express.
Khởi tạo Backend:
npm init -y
Cài đặt:
npm install express cors dotenv
npm install -D nodemon
Xây dựng API kiểm tra trạng thái:
GET /api/health
Backend chạy trên Port 5000.
4. Kết nối Frontend và Backend
Thiết lập Vite Proxy để React có thể gọi API Backend.
Cấu hình Axios sử dụng:
/api
Kiểm tra kết nối bằng:
curl http://localhost:5000/api/health
curl http://localhost:5174/api/health
Kết quả: Frontend ↔ Backend kết nối thành công. ✅