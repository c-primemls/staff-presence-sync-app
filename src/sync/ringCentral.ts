import { getRingCentralAccessToken } from "../services/ringCentral/auth/getRingCentralAccessToken";

import {
  getRingCentralSyncUsers,
  updateRingCentralPresence,
} from "../db/presence";

import { getRingCentralPresence } from "../services/ringCentral/presence/getRingCentralPresence";

type RingCentralExtension = {
  id: number | string;
  extensionNumber?: string;
  name?: string;
  type?: string;
  status?: string;
  contact?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
};

export async function resolveRingCentralExtensionIds(env: Env) {
  const accessToken = await getRingCentralAccessToken(env);

  const response = await fetch(
    "https://platform.ringcentral.com/restapi/v1.0/account/~/extension?type=User&status=Enabled&perPage=100",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `RingCentral extension request failed: ${response.status} ${text}`,
    );
  }

  const data = (await response.json()) as {
    records?: RingCentralExtension[];
  };

  const { results: users } = await env.DB.prepare(
    `
		SELECT
			id,
			email,
			ringcentral_extension_id
		FROM staff_presence_status
		ORDER BY id
	`,
  ).all<{
    id: number;
    email: string;
    ringcentral_extension_id: string | null;
  }>();

  const usersByEmail = new Map(
    users.map((user) => [user.email.toLowerCase(), user]),
  );

  const updates: D1PreparedStatement[] = [];

  for (const extension of data.records ?? []) {
    const email = extension.contact?.email?.toLowerCase();

    if (!email) {
      continue;
    }

    const user = usersByEmail.get(email);

    if (!user) {
      continue;
    }

    const extensionId = String(extension.id);

    if (user.ringcentral_extension_id === extensionId) {
      continue;
    }

    updates.push(
      env.DB.prepare(
        `
				UPDATE staff_presence_status
				SET ringcentral_extension_id = ?
				WHERE id = ?
			`,
      ).bind(extensionId, user.id),
    );
  }

  if (updates.length > 0) {
    await env.DB.batch(updates);
  }

  return {
    extensionsReturned: data.records?.length ?? 0,
    usersMatched: updates.length,
  };
}

export async function syncRingCentralPresence(env: Env) {
  const users = await getRingCentralSyncUsers(env);

  let usersUpdated = 0;

  for (const user of users) {
    try {
      const presence = await getRingCentralPresence(
        env,
        user.ringcentral_extension_id,
      );

      await updateRingCentralPresence(env, user.id, presence);

      usersUpdated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await env.DB.prepare(
        `
				UPDATE staff_presence_status
				SET last_error = ?
				WHERE id = ?
			`,
      )
        .bind(message, user.id)
        .run();
    }
  }

  return {
    usersChecked: users.length,
    usersUpdated,
  };
}
