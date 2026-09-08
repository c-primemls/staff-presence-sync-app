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
  const headers = Object.fromEntries(request.headers.entries());

  //   const validationToken = request.headers.get("Validation-Token");

  const validationToken = headers["validation-token"] ?? null;

  /*
   * Initial RingCentral webhook validation.
   *
   * RingCentral generates this token.
   * We simply echo it back.
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
   * Normal webhook notification.
   *
   * This is OUR secret configured as
   * deliveryMode.verificationToken.
   */
  //   const verificationToken = request.headers.get("Verification-Token");

  const verificationToken = headers["verification-token"] ?? null;

  if (!verificationToken) {
    console.error(
      "Rejected RingCentral webhook: Verification-Token header is missing.",
    );

    return new Response("Unauthorized", {
      status: 401,
    });
  }

  if (verificationToken !== env.RC_WEBHOOK_VERIFICATION_TOKEN) {
    console.error(
      "Rejected RingCentral webhook: verification token mismatch.",
      {
        receivedLength: verificationToken.length,
        expectedLength: env.RC_WEBHOOK_VERIFICATION_TOKEN?.length ?? 0,
      },
    );

    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const rawBody = await request.text();

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

  ctx.waitUntil(processRingCentralWebhook(env, event));

  return new Response(null, {
    status: 200,
  });
}
