export async function getRingCentralAccessToken(env: Env): Promise<string> {
  const credentials = btoa(`${env.RC_CLIENT_ID}:${env.RC_CLIENT_SECRET}`);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: env.RC_JWT,
  });

  const response = await fetch(
    "https://platform.ringcentral.com/restapi/oauth/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `RingCentral token request failed: ${response.status} ${text}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
  };

  if (!data.access_token) {
    throw new Error(
      "RingCentral token response did not contain an access token.",
    );
  }

  return data.access_token;
}

export type RingCentralPresence = {
  presenceStatus?: string;
  telephonyStatus?: string;
  userStatus?: string;
  dndStatus?: string;
  meetingStatus?: string;
};

export type RingCentralSubscription = {
  id: string;
  status?: string;
  creationTime?: string;
  expirationTime?: string;
  expiresIn?: number;
  eventFilters?: string[];
};

export async function getRingCentralPresence(
  env: Env,
  extensionId: string,
): Promise<RingCentralPresence> {
  const accessToken = await getRingCentralAccessToken(env);

  const response = await fetch(
    `https://platform.ringcentral.com/restapi/v1.0/account/~/extension/${extensionId}/presence?detailedTelephonyState=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `RingCentral presence request failed: ${response.status} ${text}`,
    );
  }

  return (await response.json()) as RingCentralPresence;
}

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

export async function deleteRingCentralWebhookSubscription(
  env: Env,
  subscriptionId: string,
): Promise<void> {
  const accessToken = await getRingCentralAccessToken(env);

  const response = await fetch(
    `https://platform.ringcentral.com/restapi/v1.0/subscription/${subscriptionId}`,
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
