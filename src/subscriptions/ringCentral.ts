import { renewRingCentralWebhookSubscription } from "../services/ringCentral/subscriptions/renewRingCentralWebhookSubscription";

import {
  getRingCentralSubscriptionRuntime,
  saveRingCentralSubscription,
} from "../db/runtime";

const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

export async function renewRingCentralWebhookNow(env: Env) {
  const runtime = await getRingCentralSubscriptionRuntime(env);

  const subscriptionId = runtime?.ringcentral_subscription_id;

  if (!subscriptionId) {
    throw new Error("No RingCentral webhook subscription ID is stored.");
  }

  const subscription = await renewRingCentralWebhookSubscription(
    env,
    subscriptionId,
  );

  await saveRingCentralSubscription(env, subscription);

  return {
    renewed: true,
    subscriptionId: subscription.id,
    expirationTime: subscription.expirationTime ?? null,
  };
}

export async function renewRingCentralWebhookIfNeeded(env: Env) {
  const runtime = await getRingCentralSubscriptionRuntime(env);

  const subscriptionId = runtime?.ringcentral_subscription_id;

  const expiresAt = runtime?.ringcentral_subscription_expires_at;

  if (!subscriptionId) {
    return {
      renewed: false,
      reason: "No subscription ID is stored.",
    };
  }

  if (!expiresAt) {
    return {
      renewed: false,
      reason: "No subscription expiration time is stored.",
    };
  }

  const expirationTime = Date.parse(expiresAt);

  if (Number.isNaN(expirationTime)) {
    throw new Error(
      `Invalid RingCentral subscription expiration time: ${expiresAt}`,
    );
  }

  const millisecondsRemaining = expirationTime - Date.now();

  /*
   * More than 24 hours remain.
   * Nothing to do.
   */
  if (millisecondsRemaining > RENEW_BEFORE_MS) {
    return {
      renewed: false,
      subscriptionId,
      expirationTime: expiresAt,
      hoursRemaining: Math.round(millisecondsRemaining / (60 * 60 * 1000)),
    };
  }

  /*
   * Less than 24 hours remain.
   * Renew the existing subscription.
   */
  return await renewRingCentralWebhookNow(env);
}
