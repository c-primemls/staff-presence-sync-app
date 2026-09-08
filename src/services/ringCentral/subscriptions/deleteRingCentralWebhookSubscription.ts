import { getRingCentralAccessToken } from "../auth/getRingCentralAccessToken";

export async function deleteRingCentralWebhookSubscription(
  env: Env,
  subscriptionId: string,
): Promise<void> {
  const accessToken = await getRingCentralAccessToken(env);

  const response = await fetch(
    `https://platform.ringcentral.com/restapi/v1.0/subscription/${encodeURIComponent(subscriptionId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok && response.status !== 404) {
    const text = await response.text();

    throw new Error(
      `RingCentral subscription delete failed: ${response.status} ${text}`,
    );
  }
}
