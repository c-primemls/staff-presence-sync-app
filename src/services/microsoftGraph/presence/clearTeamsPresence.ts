import { getMicrosoftAccessToken } from "../auth/getMicrosoftAccessToken";

export async function clearTeamsPresence(
  env: Env,
  entraUserId: string,
): Promise<void> {
  const accessToken = await getMicrosoftAccessToken(env);

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(entraUserId)}/presence/clearPresence`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: env.MS_CLIENT_ID,
      }),
    },
  );

  /*
   * 404 simply means our application's
   * presence session doesn't currently exist.
   * Treat that as already cleared.
   */
  if (!response.ok && response.status !== 404) {
    const text = await response.text();

    throw new Error(
      `Microsoft Teams clear presence failed: ${response.status} ${text}`,
    );
  }
}
