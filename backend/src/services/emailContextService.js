import prisma from "../prisma.js";
import {
  getGmailMessage,
  normalizeGmailMessage,
} from "./gmailAdapter.js";

export async function createEmailContext(userId, messageId, sourceId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  if (!messageId) {
    throw new Error("messageId is required");
  }

  if (!sourceId) {
    throw new Error("sourceId is required");
  }

  const source = await prisma.source.findFirst({
    where: {
      id: sourceId,
      userId,
      type: "email",
    },
  });

  if (!source) {
    throw new Error("Email source not found or access denied");
  }

  const message = await getGmailMessage(userId, messageId);
  const email = normalizeGmailMessage(message);

  const textBody = email.textBody?.trim() || "Không có nội dung";

const maxBodyLength = 8000;

const limitedBody =
  textBody.length > maxBodyLength
    ? `${textBody.slice(0, maxBodyLength)}\n[Email content truncated]`
    : textBody;

const content = [
  `From: ${email.from ?? "Không xác định"}`,
  `To: ${email.to ?? "Không xác định"}`,
  `Subject: ${email.subject ?? "Không có tiêu đề"}`,
  `Date: ${email.date ?? "Không xác định"}`,
  `Gmail Message ID: ${email.id ?? "Không xác định"}`,
  "",
  "Email content:",
  limitedBody,
].join("\n");

  const context = await prisma.personalContext.create({
    data: {
      type: "email",
      content,
      importance: 1,
      userId,
      sourceId: source.id,
    },
    include: {
      source: true,
    },
  });

  return context;
}