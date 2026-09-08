export async function getMicrosoftAccessToken(env: Env): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Microsoft token request failed: ${response.status} ${text}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
  };

  if (!data.access_token) {
    throw new Error(
      "Microsoft token response did not contain an access token.",
    );
  }

  return data.access_token;
}
