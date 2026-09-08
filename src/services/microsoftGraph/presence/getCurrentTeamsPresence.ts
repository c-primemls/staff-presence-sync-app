import { getMicrosoftAccessToken } from "../auth/getMicrosoftAccessToken";

export async function getCurrentTeamsPresence(
  env: Env,
  userIds: string[],
): Promise<GraphPresence[]> {
  if (!userIds.length) {
    return [];
  }

  const accessToken = await getMicrosoftAccessToken(env);

  const response = await fetch(
    "https://graph.microsoft.com/v1.0/communications/getPresencesByUserId",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids: userIds,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Microsoft Graph presence request failed: ${response.status} ${text}`,
    );
  }

  const data = (await response.json()) as {
    value?: GraphPresence[];
  };

  return data.value ?? [];
}
