import { updateRingCentralPresenceFromWebhook } from "../db/presence";

import { markRingCentralWebhookReceived } from "../db/runtime";

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

  console.log(
    "RingCentral presence webhook processed:",
    JSON.stringify({
      extensionId,
      telephonyStatus: event.body?.telephonyStatus,
      presenceStatus: event.body?.presenceStatus,
      sequence: event.body?.sequence,
      rowsUpdated: changes,
    }),
  );
}

export async function handleRingCentralWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  /*
   * RingCentral performs this validation request
   * when the webhook subscription is created.
   *
   * It sends a Validation-Token header with no
   * notification payload. We must echo it back.
   */
  const validationToken = request.headers.get("Validation-Token");

  const rawBody = await request.text();

  if (validationToken && rawBody.trim() === "") {
    return new Response(null, {
      status: 200,
      headers: {
        "Validation-Token": validationToken,
        "Content-Type": "application/json",
      },
    });
  }

  /*
   * Normal notifications must contain OUR
   * configured validation token.
   */
  if (!validationToken || validationToken !== env.RC_WEBHOOK_VALIDATION_TOKEN) {
    console.error("Rejected RingCentral webhook: invalid validation token.");

    return new Response("Unauthorized", {
      status: 401,
    });
  }

  if (!rawBody.trim()) {
    return new Response(null, {
      status: 200,
    });
  }

  let event: RingCentralPresenceEvent;

  try {
    event = JSON.parse(rawBody) as RingCentralPresenceEvent;
  } catch {
    return new Response("Invalid JSON", {
      status: 400,
    });
  }

  /*
   * Respond immediately to RingCentral and
   * continue the D1 work in the background.
   */
  ctx.waitUntil(processRingCentralWebhook(env, event));

  return new Response(null, {
    status: 200,
  });
}
