export async function markCronStarted(env: Env): Promise<void> {
  await env.DB.prepare(
    `
		UPDATE sync_runtime
		SET last_cron_at = CURRENT_TIMESTAMP
		WHERE id = 1
	`,
  ).run();
}

export async function markSyncSuccess(env: Env): Promise<void> {
  await env.DB.prepare(
    `
		UPDATE sync_runtime
		SET
			last_success_at = CURRENT_TIMESTAMP,
			last_error = NULL
		WHERE id = 1
	`,
  ).run();
}

export async function markSyncError(env: Env, message: string): Promise<void> {
  await env.DB.prepare(
    `
		UPDATE sync_runtime
		SET last_error = ?
		WHERE id = 1
	`,
  )
    .bind(message)
    .run();
}
