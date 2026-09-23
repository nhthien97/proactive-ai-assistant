import { google } from "googleapis";
import prisma from "../prisma.js";

function createOAuth2Client() {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  } = process.env;

  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  if (!GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  }

  if (!GOOGLE_REDIRECT_URI) {
    throw new Error("GOOGLE_REDIRECT_URI is not configured");
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export async function getGmailClient(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const connection = await prisma.gmailConnection.findUnique({
    where: {
      userId,
    },
  });

  if (!connection) {
    throw new Error("Gmail connection not found");
  }

  if (!connection.refreshToken && !connection.accessToken) {
    throw new Error("Gmail connection has no usable token");
  }

  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: connection.accessToken ?? undefined,
    refresh_token: connection.refreshToken ?? undefined,
    token_type: connection.tokenType ?? undefined,
    expiry_date: connection.expiryDate
      ? connection.expiryDate.getTime()
      : undefined,
  });


  return google.gmail({
    version: "v1",
    auth: oauth2Client,
  });
}

export async function listGmailMessages(userId, maxResults = 10) {
  const gmail = await getGmailClient(userId);

  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults,
  });

  return response.data.messages ?? [];
}

export async function getGmailMessage(userId, messageId) {
  if (!messageId) {
    throw new Error("messageId is required");
  }

  const gmail = await getGmailClient(userId);

  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  return response.data;
}

function decodeBase64Url(data) {
  if (!data) {
    return "";
  }

  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf8");
}

function getHeader(headers, name) {
  const header = headers?.find(
    (item) => item.name?.toLowerCase() === name.toLowerCase()
  );

  return header?.value ?? null;
}

function extractEmailBody(payload) {
  if (!payload) {
    return "";
  }

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const body = extractEmailBody(part);

      if (body) {
        return body;
      }
    }
  }

  return "";
}

function htmlToPlainText(html) {
  if (!html) {
    return "";
  }

  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeGmailMessage(message) {
  if (!message) {
    throw new Error("Gmail message is required");
  }

  const headers = message.payload?.headers ?? [];
  const body = extractEmailBody(message.payload);

  return {
    id: message.id ?? null,
    threadId: message.threadId ?? null,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    messageId: getHeader(headers, "Message-ID"),
    body,
    textBody: htmlToPlainText(body),
    labelIds: message.labelIds ?? [],
  };
}