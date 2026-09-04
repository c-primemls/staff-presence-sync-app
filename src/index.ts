import { renderHtml } from "./renderHtml";

export default {
	async fetch(request, env) {
		const stmt = env.DB.prepare(
			"SELECT * FROM staff_presence_status ORDER BY id"
		);

		const { results } = await stmt.all();

		return new Response(
			renderHtml(JSON.stringify(results, null, 2)),
			{
				headers: {
					"content-type": "text/html",
				},
			}
		);
	},

	async scheduled(controller, env, ctx) {
		await env.DB.prepare(`
			UPDATE sync_runtime
			SET last_cron_at = CURRENT_TIMESTAMP
			WHERE id = 1
		`).run();

		console.log("CRON FIRED");
	},
} satisfies ExportedHandler<Env>;
