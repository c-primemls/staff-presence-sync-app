import { getTeamsSyncUsers, updateTeamsPresenceBatch } from "../db/presence";

import { getCurrentTeamsPresence } from "../services/microsoftGraph/presence/getCurrentTeamsPresence";

export async function syncTeamsPresence(env: Env) {
  const users = await getTeamsSyncUsers(env);

  if (!users.length) {
    return {
      usersChecked: 0,
      usersUpdated: 0,
      presence: [],
    };
  }

  const userIds = users
    .map((user) => user.entra_user_id)
    .filter((id): id is string => Boolean(id));

  const presenceResults = await getCurrentTeamsPresence(env, userIds);

  const usersByEntraId = new Map(
    users
      .filter((user) => user.entra_user_id)
      .map((user) => [String(user.entra_user_id).toLowerCase(), user]),
  );

  const updates: Array<{
    userId: number;
    status: string;
  }> = [];

  for (const presence of presenceResults) {
    const user = usersByEntraId.get(String(presence.id).toLowerCase());

    if (!user) {
      continue;
    }

    updates.push({
      userId: user.id,
      status: presence.availability,
    });
  }

  await updateTeamsPresenceBatch(env, updates);

  return {
    usersChecked: users.length,
    usersUpdated: updates.length,
    presence: presenceResults,
  };
}
