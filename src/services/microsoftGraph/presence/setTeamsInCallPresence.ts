import { getMicrosoftAccessToken } from "../auth/getMicrosoftAccessToken";

export async function setTeamsInCallPresence(
  env: Env,
  entraUserId: string,
): Promise<void> {
  const accessToken = await getMicrosoftAccessToken(env);

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(entraUserId)}/presence/setPresence`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: env.MS_CLIENT_ID,
        availability: "Busy",
        activity: "InACall",
        expirationDuration: "PT5M",
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Microsoft Teams set presence failed: ${response.status} ${text}`,
    );
  }
}
