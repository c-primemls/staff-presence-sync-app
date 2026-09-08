import { getRingCentralAccessToken } from "../auth/getRingCentralAccessToken";

import type { RingCentralPresence } from "../../../types/ringCentral/ringCentralTypes";

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
