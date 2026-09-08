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

export async function saveRingCentralSubscription(
  env: Env,
  subscription: {
    id: string;
    expirationTime?: string;
  },
): Promise<void> {
  await env.DB.prepare(
    `
		UPDATE sync_runtime
		SET
			ringcentral_subscription_id = ?,
			ringcentral_subscription_expires_at = ?
		WHERE id = 1
	`,
  )
    .bind(subscription.id, subscription.expirationTime ?? null)
    .run();
}

export async function markRingCentralWebhookReceived(env: Env): Promise<void> {
  await env.DB.prepare(
    `
		UPDATE sync_runtime
		SET last_ringcentral_webhook_at =
			CURRENT_TIMESTAMP
		WHERE id = 1
	`,
  ).run();
}
