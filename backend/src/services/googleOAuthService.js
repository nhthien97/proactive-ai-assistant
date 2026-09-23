import { google } from "googleapis";

const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
];

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

export function getGoogleAuthorizationUrl(state) {
  if (!state) {
    throw new Error("OAuth state is required");
  }

  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: GOOGLE_SCOPES,
  state,
});
}

export async function exchangeGoogleCode(code) {
  if (!code) {
    throw new Error("Google authorization code is required");
  }

  const oauth2Client = createOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);

  return {
    tokens,
    oauth2Client,
  };
}

export async function getGoogleUserInfo(oauth2Client) {
  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: "v2",
  });

  const { data } = await oauth2.userinfo.get();

  return data;
}
