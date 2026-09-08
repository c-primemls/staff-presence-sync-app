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
