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
  const validationToken = request.headers.get("Validation-Token");

  const rawBody = await request.text();

  /*
   * Subscription validation handshake.
   *
   * RingCentral sends an empty request containing
   * a Validation-Token. We echo that exact value.
   */
  if (!rawBody.trim()) {
    if (!validationToken) {
      console.error(
        "RingCentral validation request contained no Validation-Token.",
      );

      return new Response("Bad Request", {
        status: 400,
      });
    }

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
   * Normal notification.
   *
   * For Subscription API webhooks, RingCentral
   * sends the validationToken we supplied when
   * creating the subscription.
   */
  if (!validationToken) {
    console.error(
      "Rejected RingCentral webhook: Validation-Token header is missing.",
    );

    return new Response("Unauthorized", {
      status: 401,
    });
  }

  if (!env.RC_WEBHOOK_VALIDATION_TOKEN) {
    console.error(
      "RC_WEBHOOK_VALIDATION_TOKEN is missing from the Worker environment.",
    );

    return new Response("Server configuration error", {
      status: 500,
    });
  }

  if (validationToken !== env.RC_WEBHOOK_VALIDATION_TOKEN) {
    console.error("Rejected RingCentral webhook: validation token mismatch.", {
      receivedLength: validationToken.length,
      expectedLength: env.RC_WEBHOOK_VALIDATION_TOKEN.length,
    });

    return new Response("Unauthorized", {
      status: 401,
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

  ctx.waitUntil(processRingCentralWebhook(env, event));

  return new Response(null, {
    status: 200,
  });
}
