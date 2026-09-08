function escapeHtml(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function statusClass(status: unknown): string {
	const value = String(status || "").toLowerCase();

	if (value === "available") return "available";
	if (value === "busy") return "busy";
	if (value === "away") return "away";

	if (
		value === "donotdisturb" ||
		value === "do not disturb"
	) {
		return "dnd";
	}

	if (value === "offline") return "offline";

	return "unknown";
}

function formatStatus(status: unknown): string {
	if (!status) {
		return "Unknown";
	}

	if (status === "DoNotDisturb") {
		return "Do Not Disturb";
	}

	return String(status);
}

function timestamp(value: unknown): string {
	if (!value) {
		return "Never";
	}

	return `<span data-utc="${escapeHtml(value)}">${escapeHtml(value)}</span>`;
}

export function renderHtml(
	users: any[],
	runtime: any,
): string {
	const syncedCount = users.filter((user) => {
		if (
			!user.current_teams_status ||
			!user.current_ringcentral_status
		) {
			return false;
		}

		return (
			String(user.current_teams_status).toLowerCase() ===
			String(user.current_ringcentral_status).toLowerCase()
		);
	}).length;

	const mismatchCount = users.filter((user) => {
		if (
			!user.current_teams_status ||
			!user.current_ringcentral_status
		) {
			return false;
		}

		return (
			String(user.current_teams_status).toLowerCase() !==
			String(user.current_ringcentral_status).toLowerCase()
		);
	}).length;

	const rows = users
		.map((user) => {
			const teams = user.current_teams_status;
			const ringCentral =
				user.current_ringcentral_status;

			const synced =
				teams &&
				ringCentral &&
				String(teams).toLowerCase() ===
					String(ringCentral).toLowerCase();

			return `
				<tr>
					<td class="user">
						<div class="avatar">
							${escapeHtml(
								user.email?.charAt(0).toUpperCase() ||
									"?",
							)}
						</div>

						${escapeHtml(user.email)}
					</td>

					<td>
						<span class="status ${statusClass(teams)}">
							<span class="dot"></span>
							${escapeHtml(formatStatus(teams))}
						</span>
					</td>

					<td>
						<span class="status ${statusClass(ringCentral)}">
							<span class="dot"></span>
							${escapeHtml(formatStatus(ringCentral))}
						</span>
					</td>

					<td>
						<span class="sync ${
							synced ? "synced" : "mismatch"
						}">
							${synced ? "Synced" : "Mismatch"}
						</span>
					</td>

					<td>${timestamp(user.last_sync_at)}</td>

					<td class="error">
						${escapeHtml(user.last_error || "—")}
					</td>
				</tr>
			`;
		})
		.join("");

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta
		name="viewport"
		content="width=device-width, initial-scale=1.0"
	>

	<title>Staff Presence Sync</title>

	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			font-family:
				Inter,
				-apple-system,
				BlinkMacSystemFont,
				"Segoe UI",
				sans-serif;
			background: #f5f7fa;
			color: #17202a;
		}

		header {
			background: white;
			border-bottom: 1px solid #e5e8eb;
		}

		.header-inner,
		main {
			max-width: 1400px;
			margin: 0 auto;
			padding: 22px 32px;
		}

		.header-inner {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 20px;
		}

		h1 {
			margin: 0;
			font-size: 22px;
		}

		.subtitle {
			color: #697586;
			font-size: 13px;
			margin-top: 5px;
		}

		button {
			border: 1px solid #d5dae0;
			background: white;
			border-radius: 7px;
			padding: 9px 14px;
			cursor: pointer;
		}

		button:disabled {
			opacity: .6;
			cursor: wait;
		}

		.cards {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 16px;
			margin-bottom: 22px;
		}

		.card,
		.table-container {
			background: white;
			border: 1px solid #e3e7eb;
			border-radius: 10px;
		}

		.card {
			padding: 18px;
		}

		.label {
			font-size: 12px;
			color: #697586;
			margin-bottom: 8px;
		}

		.value {
			font-size: 27px;
			font-weight: 650;
		}

		.runtime-value {
			font-size: 14px;
			font-weight: 550;
		}

		.table-container {
			overflow: hidden;
		}

		.table-heading {
			padding: 17px 20px;
			border-bottom: 1px solid #e3e7eb;
			font-weight: 650;
		}

		table {
			width: 100%;
			border-collapse: collapse;
		}

		th {
			text-align: left;
			background: #fafbfc;
			color: #657180;
			font-size: 12px;
			padding: 12px 16px;
			border-bottom: 1px solid #e3e7eb;
		}

		td {
			padding: 14px 16px;
			border-bottom: 1px solid #edf0f2;
			font-size: 14px;
		}

		.user {
			display: flex;
			align-items: center;
			gap: 10px;
			font-weight: 500;
		}

		.avatar {
			width: 32px;
			height: 32px;
			border-radius: 50%;
			background: #eef2f6;
			display: flex;
			align-items: center;
			justify-content: center;
			font-weight: 650;
		}

		.status {
			display: inline-flex;
			align-items: center;
			gap: 7px;
			padding: 5px 9px;
			border-radius: 999px;
			background: #f3f4f6;
			font-size: 12px;
		}

		.dot {
			width: 7px;
			height: 7px;
			border-radius: 50%;
			background: #949ba4;
		}

		.available {
			background: #ecf8f1;
			color: #18794e;
		}

		.available .dot {
			background: #20a464;
		}

		.busy {
			background: #fceded;
			color: #b42318;
		}

		.busy .dot {
			background: #d92d20;
		}

		.away {
			background: #fff7e6;
			color: #986a00;
		}

		.away .dot {
			background: #f0a500;
		}

		.dnd {
			background: #f4eefe;
			color: #6941c6;
		}

		.dnd .dot {
			background: #7f56d9;
		}

		.offline {
			background: #f2f4f7;
			color: #667085;
		}

		.offline .dot {
			background: #98a2b3;
		}

		.sync {
			padding: 4px 8px;
			border-radius: 5px;
			font-size: 12px;
			font-weight: 600;
		}

		.synced {
			background: #ecf8f1;
			color: #18794e;
		}

		.mismatch {
			background: #fff3e8;
			color: #b54708;
		}

		.error {
			color: #b42318;
			font-size: 12px;
		}

		.runtime-error {
			margin-top: 16px;
			padding: 12px 14px;
			border-radius: 8px;
			background: #fceded;
			color: #b42318;
			font-size: 13px;
		}

		@media (max-width: 900px) {
			.cards {
				grid-template-columns: 1fr 1fr;
			}

			.table-container {
				overflow-x: auto;
			}

			table {
				min-width: 950px;
			}
		}
	</style>
</head>

<body>

<header>
	<div class="header-inner">
		<div>
			<h1>Staff Presence Sync</h1>

			<div class="subtitle">
				Microsoft Teams ↔ RingCentral
			</div>
		</div>

		<button id="sync-button">
			Sync Teams Now
		</button>
	</div>
</header>

<main>

	<div class="cards">

		<div class="card">
			<div class="label">Users</div>
			<div class="value">${users.length}</div>
		</div>

		<div class="card">
			<div class="label">Synced</div>
			<div class="value">${syncedCount}</div>
		</div>

		<div class="card">
			<div class="label">Mismatches</div>
			<div class="value">${mismatchCount}</div>
		</div>

		<div class="card">
			<div class="label">Last Successful Teams Sync</div>
			<div class="runtime-value">
				${timestamp(runtime?.last_success_at)}
			</div>
		</div>

	</div>

	<div class="table-container">

		<div class="table-heading">
			User Presence
		</div>

		<table>
			<thead>
				<tr>
					<th>User</th>
					<th>Microsoft Teams</th>
					<th>RingCentral</th>
					<th>Sync Status</th>
					<th>Last Sync</th>
					<th>Last Error</th>
				</tr>
			</thead>

			<tbody>
				${rows}
			</tbody>
		</table>

	</div>

	${
		runtime?.last_error
			? `
				<div class="runtime-error">
					<strong>Automated sync error:</strong>
					${escapeHtml(runtime.last_error)}
				</div>
			`
			: ""
	}

</main>

<script>
	function convertUtcTimestamps() {
		document.querySelectorAll("[data-utc]").forEach((element) => {
			const value = element.getAttribute("data-utc");

			if (!value) {
				return;
			}

			const date = new Date(
				value.replace(" ", "T") + "Z"
			);

			if (!Number.isNaN(date.getTime())) {
				element.textContent =
					date.toLocaleString();
			}
		});
	}

	convertUtcTimestamps();

	document
		.getElementById("sync-button")
		.addEventListener("click", async () => {
			const button =
				document.getElementById("sync-button");

			button.disabled = true;
			button.textContent = "Syncing...";

			try {
				const response = await fetch(
					"/api/sync-teams",
					{
						method: "POST"
					}
				);

				const data = await response.json();

				if (!response.ok) {
					throw new Error(
						data.error || "Sync failed"
					);
				}

				window.location.reload();
			} catch (error) {
				alert(error.message);

				button.disabled = false;
				button.textContent = "Sync Teams Now";
			}
		});

	setTimeout(() => {
		window.location.reload();
	}, 30000);
</script>

</body>
</html>
	`;
}
