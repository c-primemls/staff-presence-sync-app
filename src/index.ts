import { renderHtml } from "./renderHtml";

type PresenceUser = {
	id: number;
	email: string;
	entra_user_id: string | null;
	current_teams_status: string | null;
	current_ringcentral_status: string | null;
	last_sync_at: string | null;
	last_error: string | null;
};

type SyncRuntime = {
	id: number;
	last_cron_at: string | null;
	last_success_at: string | null;
	last_error: string | null;
};

type GraphPresence = {
	id: string;
	availability: string;
	activity: string;
};

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function getMicrosoftAccessToken(env: Env): Promise<string> {
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
		throw new Error("Microsoft token response did not contain an access token.");
	}

	return data.access_token;
}

async function syncTeamsPresence(env: Env) {
	const { results: users } = await env.DB.prepare(`
		SELECT
			id,
			email,
			entra_user_id
		FROM staff_presence_status
		WHERE entra_user_id IS NOT NULL
		  AND entra_user_id != ''
		ORDER BY id
	`).all<Pick<PresenceUser, "id" | "email" | "entra_user_id">>();

	if (!users.length) {
		return {
			usersChecked: 0,
			usersUpdated: 0,
			presence: [],
		};
	}

	const accessToken = await getMicrosoftAccessToken(env);

	const ids = users
		.map((user) => user.entra_user_id)
		.filter((id): id is string => Boolean(id));

	const response = await fetch(
		"https://graph.microsoft.com/v1.0/communications/getPresencesByUserId",
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				ids,
			}),
		},
	);

	if (!response.ok) {
		const text = await response.text();

		throw new Error(
			`Microsoft Graph presence request failed: ${response.status} ${text}`,
		);
	}

	const data = (await response.json()) as {
		value?: GraphPresence[];
	};

	const presenceResults = data.value ?? [];

	const usersByEntraId = new Map(
		users
			.filter((user) => user.entra_user_id)
			.map((user) => [
				String(user.entra_user_id).toLowerCase(),
				user,
			]),
	);

	const updates: D1PreparedStatement[] = [];

	for (const presence of presenceResults) {
		const user = usersByEntraId.get(
			String(presence.id).toLowerCase(),
		);

		if (!user) {
			continue;
		}

		updates.push(
			env.DB.prepare(`
				UPDATE staff_presence_status
				SET
					current_teams_status = ?,
					last_sync_at = CURRENT_TIMESTAMP,
					last_error = NULL
				WHERE id = ?
			`).bind(
				presence.availability,
				user.id,
			),
		);
	}

	if (updates.length > 0) {
		await env.DB.batch(updates);
	}

	return {
		usersChecked: users.length,
		usersUpdated: updates.length,
		presence: presenceResults,
	};
}

async function markSyncSuccess(env: Env): Promise<void> {
	await env.DB.prepare(`
		UPDATE sync_runtime
		SET
			last_success_at = CURRENT_TIMESTAMP,
			last_error = NULL
		WHERE id = 1
	`).run();
}

async function markSyncError(
	env: Env,
	message: string,
): Promise<void> {
	await env.DB.prepare(`
		UPDATE sync_runtime
		SET last_error = ?
		WHERE id = 1
	`)
		.bind(message)
		.run();
}

async function getDashboardData(env: Env) {
	const { results: users } = await env.DB.prepare(`
		SELECT
			id,
			email,
			current_teams_status,
			current_ringcentral_status,
			last_sync_at,
			last_error
		FROM staff_presence_status
		ORDER BY email
	`).all<PresenceUser>();

	const runtime = await env.DB.prepare(`
		SELECT
			id,
			last_cron_at,
			last_success_at,
			last_error
		FROM sync_runtime
		WHERE id = 1
	`).first<SyncRuntime>();

	return {
		users,
		runtime,
	};
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		/*
		 * Manual Teams sync.
		 * Useful for testing without waiting for the next cron.
		 */
		if (url.pathname === "/api/sync-teams") {
			if (request.method !== "POST") {
				return new Response("Method Not Allowed", {
					status: 405,
					headers: {
						Allow: "POST",
					},
				});
			}

			try {
				const result = await syncTeamsPresence(env);

				await markSyncSuccess(env);

				return Response.json({
					success: true,
					...result,
				});
			} catch (error) {
				const message = getErrorMessage(error);

				console.error("Manual Teams sync failed:", message);

				await markSyncError(env, message);

				return Response.json(
					{
						success: false,
						error: message,
					},
					{
						status: 500,
					},
				);
			}
		}

		try {
			const { users, runtime } =
				await getDashboardData(env);

			if (url.pathname === "/api/users") {
				return Response.json(
					{
						users,
						runtime,
					},
					{
						headers: {
							"Cache-Control": "no-store",
						},
					},
				);
			}

			if (url.pathname === "/") {
				return new Response(
					renderHtml(users, runtime),
					{
						headers: {
							"Content-Type":
								"text/html; charset=UTF-8",
							"Cache-Control": "no-store",
						},
					},
				);
			}

			return new Response("Not Found", {
				status: 404,
			});
		} catch (error) {
			const message = getErrorMessage(error);

			console.error(message);

			return new Response(
				`Database error: ${message}`,
				{
					status: 500,
					headers: {
						"Content-Type":
							"text/plain; charset=UTF-8",
					},
				},
			);
		}
	},

	async scheduled(controller, env, ctx) {
		await env.DB.prepare(`
			UPDATE sync_runtime
			SET last_cron_at = CURRENT_TIMESTAMP
			WHERE id = 1
		`).run();

		try {
			const result = await syncTeamsPresence(env);

			await markSyncSuccess(env);

			console.log(
				"Scheduled Teams sync completed:",
				JSON.stringify(result),
			);
		} catch (error) {
			const message = getErrorMessage(error);

			await markSyncError(env, message);

			console.error(
				"Scheduled Teams sync failed:",
				message,
			);

			throw error;
		}
	},
} satisfies ExportedHandler<Env>;
