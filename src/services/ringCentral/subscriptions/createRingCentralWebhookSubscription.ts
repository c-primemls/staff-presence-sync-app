import { getRingCentralAccessToken } from "../auth/getRingCentralAccessToken";

import type { RingCentralSubscription } from "../../../types/ringCentral/ringCentralTypes";

export async function createRingCentralWebhookSubscription(
  env: Env,
  webhookAddress: string,
): Promise<RingCentralSubscription> {
  if (!env.RC_WEBHOOK_VALIDATION_TOKEN) {
    throw new Error(
      "RC_WEBHOOK_VALIDATION_TOKEN is missing from the Worker environment.",
    );
  }

  const accessToken = await getRingCentralAccessToken(env);

  const response = await fetch(
    "https://platform.ringcentral.com/restapi/v1.0/subscription",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventFilters: ["/restapi/v1.0/account/~/presence"],

        deliveryMode: {
          transportType: "WebHook",
          address: webhookAddress,
          validationToken: env.RC_WEBHOOK_VALIDATION_TOKEN,
        },

        expiresIn: 604799,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `RingCentral webhook subscription failed: ${response.status} ${text}`,
    );
  }

  return (await response.json()) as RingCentralSubscription;
}
