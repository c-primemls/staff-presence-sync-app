import type { PresenceUser, SyncRuntime } from "../types/presence";

export async function getTeamsSyncUsers(env: Env) {
  const { results } = await env.DB.prepare(
    `
		SELECT
			id,
			email,
			entra_user_id
		FROM staff_presence_status
		WHERE entra_user_id IS NOT NULL
		  AND entra_user_id != ''
		ORDER BY id
	`,
  ).all<Pick<PresenceUser, "id" | "email" | "entra_user_id">>();

  return results;
}

export async function updateTeamsPresence(
  env: Env,
  userId: number,
  status: string,
): Promise<void> {
  await env.DB.prepare(
    `
		UPDATE staff_presence_status
		SET
			current_teams_status = ?,
			last_sync_at = CURRENT_TIMESTAMP,
			last_error = NULL
		WHERE id = ?
	`,
  )
    .bind(status, userId)
    .run();
}

export async function updateTeamsPresenceBatch(
  env: Env,
  updates: Array<{
    userId: number;
    status: string;
  }>,
): Promise<void> {
  if (!updates.length) {
    return;
  }

  const statements = updates.map((update) =>
    env.DB.prepare(
      `
			UPDATE staff_presence_status
			SET
				current_teams_status = ?,
				last_sync_at = CURRENT_TIMESTAMP,
				last_error = NULL
			WHERE id = ?
		`,
    ).bind(update.status, update.userId),
  );

  await env.DB.batch(statements);
}

export async function getDashboardData(env: Env) {
  const { results: users } = await env.DB.prepare(
    `
		SELECT
			id,
			email,
			entra_user_id,
			ringcentral_extension_id,
			current_teams_status,
			current_ringcentral_status,
			last_sync_at,
			last_error
		FROM staff_presence_status
		ORDER BY email
	`,
  ).all<PresenceUser>();

  const runtime = await env.DB.prepare(
    `
		SELECT
			id,
			last_cron_at,
			last_success_at,
			last_error
		FROM sync_runtime
		WHERE id = 1
	`,
  ).first<SyncRuntime>();

  return {
    users,
    runtime,
  };
}

export async function getRingCentralSyncUsers(env: Env) {
  const { results } = await env.DB.prepare(
    `
		SELECT
			id,
			email,
			ringcentral_extension_id
		FROM staff_presence_status
		WHERE ringcentral_extension_id IS NOT NULL
		  AND ringcentral_extension_id != ''
		ORDER BY id
	`,
  ).all<{
    id: number;
    email: string;
    ringcentral_extension_id: string;
  }>();

  return results;
}

export async function updateRingCentralPresence(
  env: Env,
  userId: number,
  presence: {
    presenceStatus?: string;
    telephonyStatus?: string;
    userStatus?: string;
    dndStatus?: string;
  },
): Promise<void> {
  await env.DB.prepare(
    `
		UPDATE staff_presence_status
		SET
			current_ringcentral_status = ?,
			ringcentral_telephony_status = ?,
			ringcentral_user_status = ?,
			ringcentral_dnd_status = ?,
			last_sync_at = CURRENT_TIMESTAMP,
			last_error = NULL
		WHERE id = ?
	`,
  )
    .bind(
      presence.presenceStatus ?? null,
      presence.telephonyStatus ?? null,
      presence.userStatus ?? null,
      presence.dndStatus ?? null,
      userId,
    )
    .run();
}
