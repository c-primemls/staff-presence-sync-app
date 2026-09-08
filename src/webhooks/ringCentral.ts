import { updateRingCentralPresenceFromWebhook } from "../db/presence";

import { markRingCentralWebhookReceived } from "../db/runtime";

import { applyRingCentralTelephonyStatusToTeams } from "../sync/ringCentralToTeams/applyRingCentralTelephonyStatusToTeams";

type RingCentralPresenceEvent = {
  uuid?: string;
  event?: string;
  timestamp?: string;
  subscriptionId?: string;
  ownerId?: string;

  body?: {
    extensionId?: string;
    telephonyStatus?: string;
    presenceStatus?: string;
    userStatus?: string;
    meetingStatus?: string;
    dndStatus?: string;
    sequence?: number;
  };
};

async function processRingCentralWebhook(
  env: Env,
  event: RingCentralPresenceEvent,
): Promise<void> {
  const extensionId = event.body?.extensionId;

  if (!extensionId) {
    console.log("RingCentral webhook contained no extensionId.");

    return;
  }

  const changes = await updateRingCentralPresenceFromWebhook(
    env,
    String(extensionId),
    {
      presenceStatus: event.body?.presenceStatus,

      telephonyStatus: event.body?.telephonyStatus,

      userStatus: event.body?.userStatus,

      dndStatus: event.body?.dndStatus,
    },
  );

  await markRingCentralWebhookReceived(env);

  let teamsResult;

  try {
    teamsResult = await applyRingCentralTelephonyStatusToTeams(
      env,
      String(extensionId),
      event.body?.telephonyStatus,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("RingCentral to Teams sync failed:", {
      extensionId,
      telephonyStatus: event.body?.telephonyStatus,
      error: message,
    });

    teamsResult = {
      action: "error",
      reason: message,
    };
  }

  // console.log(
  //   "RingCentral presence webhook processed:",
  //   JSON.stringify({
  //     extensionId,
  //     telephonyStatus: event.body?.telephonyStatus,
  //     presenceStatus: event.body?.presenceStatus,
  //     sequence: event.body?.sequence,
  //     rowsUpdated: changes,
  //   }),
  // );

  console.log(
    "RingCentral presence webhook processed:",
    JSON.stringify({
      extensionId,
      telephonyStatus: event.body?.telephonyStatus,
      presenceStatus: event.body?.presenceStatus,
      sequence: event.body?.sequence,
      rowsUpdated: changes,
      teamsAction: teamsResult.action,
    }),
  );
}

export async function handleRingCentralWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const validationToken = request.headers.get("validation-token");

  /*
   * RingCentral subscription validation handshake.
   *
   * RingCentral sends Validation-Token when the
   * subscription is initially created.
   * Echo it back and stop processing.
   */
  if (validationToken) {
    console.log("RingCentral webhook validation request received.");

    return new Response(null, {
      status: 200,
      headers: {
        "Validation-Token": validationToken,
        "Content-Type": "application/json",
      },
    });
  }

  /*
   * Normal webhook event.
   *
   * Normal presence notifications do NOT need
   * to contain the handshake Validation-Token.
   */
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    console.error("RingCentral webhook contained an empty body.");

    return new Response("Bad Request", {
      status: 400,
    });
  }

  let event: RingCentralPresenceEvent;

  try {
    event = JSON.parse(rawBody) as RingCentralPresenceEvent;
  } catch {
    console.error("RingCentral webhook contained invalid JSON.");

    return new Response("Invalid JSON", {
      status: 400,
    });
  }

  /*
   * Verify the notification belongs to the
   * subscription that this Worker created.
   */
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

  if (
    runtime?.ringcentral_subscription_id &&
    event.subscriptionId !== runtime.ringcentral_subscription_id
  ) {
    console.error("Rejected RingCentral webhook: subscription ID mismatch.", {
      receivedSubscriptionId: event.subscriptionId ?? null,
    });

    return new Response("Unauthorized", {
      status: 401,
    });
  }

  ctx.waitUntil(processRingCentralWebhook(env, event));

  return new Response(null, {
    status: 200,
  });
}
