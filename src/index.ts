import { renderHtml } from "./renderHtml";

import { getDashboardData } from "./db/presence";

import { markCronStarted, markSyncError, markSyncSuccess } from "./db/runtime";

import { syncTeamsPresence } from "./sync/teams";

import { getRingCentralAccessToken } from "./services/ringCentral/auth/getRingCentralAccessToken";

import {
  resolveRingCentralExtensionIds,
  syncRingCentralPresence,
} from "./sync/ringCentral";

import { getErrorMessage } from "./utils/errors";

import { createRingCentralWebhookSubscription } from "./services/ringCentral/subscriptions/createRingCentralWebhookSubscription";

import { deleteRingCentralWebhookSubscription } from "./services/ringCentral/subscriptions/deleteRingCentralWebhookSubscription";

import {
  renewRingCentralWebhookIfNeeded,
  renewRingCentralWebhookNow,
} from "./subscriptions/ringCentral";

import { saveRingCentralSubscription } from "./db/runtime";

import { handleRingCentralWebhook } from "./webhooks/ringCentral";

import { setTeamsInCallPresence } from "./services/microsoftGraph/presence/setTeamsInCallPresence";

import { clearTeamsPresence } from "./services/microsoftGraph/presence/clearTeamsPresence";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/webhooks/ringcentral") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "POST",
          },
        });
      }

      return handleRingCentralWebhook(request, env, ctx);
    }

    /*
     * Manual Microsoft Teams sync.
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

    /*
     * Temporary RingCentral authentication test.
     */
    if (url.pathname === "/api/test-ringcentral") {
      try {
        await getRingCentralAccessToken(env);

        return Response.json({
          success: true,
          message: "RingCentral authentication is working.",
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: getErrorMessage(error),
          },
          {
            status: 500,
          },
        );
      }
    }

    if (url.pathname === "/api/resolve-ringcentral-users") {
      try {
        const result = await resolveRingCentralExtensionIds(env);

        return Response.json({
          success: true,
          ...result,
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: getErrorMessage(error),
          },
          {
            status: 500,
          },
        );
      }
    }

    if (url.pathname === "/api/sync-ringcentral") {
      try {
        const result = await syncRingCentralPresence(env);

        return Response.json({
          success: true,
          ...result,
        });
      } catch (error) {
        const message = getErrorMessage(error);

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

    if (url.pathname === "/api/create-ringcentral-webhook") {
      try {
        const runtime = await env.DB.prepare(
          `
				SELECT
					ringcentral_subscription_id
				FROM sync_runtime
				WHERE id = 1
			`,
        ).first<{
          ringcentral_subscription_id: string | null;
        }>();

        if (runtime?.ringcentral_subscription_id) {
          await deleteRingCentralWebhookSubscription(
            env,
            runtime.ringcentral_subscription_id,
          );
        }

        const subscription = await createRingCentralWebhookSubscription(
          env,
          "https://staff-presence-sync-app.clayton-ac3.workers.dev/webhooks/ringcentral",
        );

        await saveRingCentralSubscription(env, subscription);

        return Response.json({
          success: true,
          subscription,
        });
      } catch (error) {
        const message = getErrorMessage(error);

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

    if (url.pathname === "/api/renew-ringcentral-webhook") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "POST",
          },
        });
      }

      try {
        const result = await renewRingCentralWebhookNow(env);

        return Response.json({
          success: true,
          ...result,
        });
      } catch (error) {
        const message = getErrorMessage(error);

        console.error("Manual RingCentral webhook renewal failed:", message);

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

    if (url.pathname === "/api/test-teams-in-call") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "POST",
          },
        });
      }

      try {
        const user = await env.DB.prepare(
          `
        SELECT
          email,
          entra_user_id
        FROM staff_presence_status
        WHERE entra_user_id IS NOT NULL
          AND entra_user_id != ''
        ORDER BY id
        LIMIT 1
      `,
        ).first<{
          email: string;
          entra_user_id: string;
        }>();

        if (!user) {
          return Response.json(
            {
              success: false,
              error: "No user with an Entra ID was found.",
            },
            {
              status: 404,
            },
          );
        }

        await setTeamsInCallPresence(env, user.entra_user_id);

        return Response.json({
          success: true,
          email: user.email,
          presence: "Busy / InACall",
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: getErrorMessage(error),
          },
          {
            status: 500,
          },
        );
      }
    }

    if (url.pathname === "/api/test-teams-clear") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "POST",
          },
        });
      }

      try {
        const user = await env.DB.prepare(
          `
        SELECT
          email,
          entra_user_id
        FROM staff_presence_status
        WHERE entra_user_id IS NOT NULL
          AND entra_user_id != ''
        ORDER BY id
        LIMIT 1
      `,
        ).first<{
          email: string;
          entra_user_id: string;
        }>();

        if (!user) {
          return Response.json(
            {
              success: false,
              error: "No user with an Entra ID was found.",
            },
            {
              status: 404,
            },
          );
        }

        await clearTeamsPresence(env, user.entra_user_id);

        return Response.json({
          success: true,
          email: user.email,
          presenceSessionCleared: true,
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: getErrorMessage(error),
          },
          {
            status: 500,
          },
        );
      }
    }

    /*
     * Dashboard/API.
     */
    try {
      const { users, runtime } = await getDashboardData(env);

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
        return new Response(renderHtml(users, runtime), {
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Cache-Control": "no-store",
          },
        });
      }

      return new Response("Not Found", {
        status: 404,
      });
    } catch (error) {
      const message = getErrorMessage(error);

      console.error(message);

      return new Response(`Database error: ${message}`, {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
        },
      });
    }
  },

  async scheduled(controller, env, ctx) {
    await markCronStarted(env);

    try {
      const result = await syncTeamsPresence(env);

      await markSyncSuccess(env);

      console.log("Scheduled Teams sync completed:", JSON.stringify(result));
    } catch (error) {
      const message = getErrorMessage(error);

      await markSyncError(env, message);

      console.error("Scheduled Teams sync failed:", message);

      throw error;
    }

    try {
      const renewalResult = await renewRingCentralWebhookIfNeeded(env);

      if (renewalResult.renewed) {
        console.log(
          "RingCentral webhook subscription renewed:",
          JSON.stringify(renewalResult),
        );
      }
    } catch (error) {
      const message = getErrorMessage(error);

      console.error("RingCentral webhook renewal failed:", message);
    }
  },
} satisfies ExportedHandler<Env>;
