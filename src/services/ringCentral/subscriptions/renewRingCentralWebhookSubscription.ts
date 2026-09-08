import { getRingCentralAccessToken } from "../auth/getRingCentralAccessToken";

import type { RingCentralSubscription } from "../../../types/ringCentral/ringCentralTypes";

export async function renewRingCentralWebhookSubscription(
  env: Env,
  subscriptionId: string,
): Promise<RingCentralSubscription> {
  const accessToken = await getRingCentralAccessToken(env);

  const response = await fetch(
    `https://platform.ringcentral.com/restapi/v1.0/subscription/${encodeURIComponent(subscriptionId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `RingCentral webhook renewal failed: ${response.status} ${text}`,
    );
  }

  return (await response.json()) as RingCentralSubscription;
}
