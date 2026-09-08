import { setTeamsInCallPresence } from "../../services/microsoftGraph/presence/setTeamsInCallPresence";

import { clearTeamsPresence } from "../../services/microsoftGraph/presence/clearTeamsPresence";

type RingCentralToTeamsResult = {
  action: "set-in-call" | "cleared" | "ignored";

  email?: string;
  reason?: string;
};

export async function applyRingCentralTelephonyStatusToTeams(
  env: Env,
  extensionId: string,
  telephonyStatus?: string,
): Promise<RingCentralToTeamsResult> {
  /*
   * Find the user represented by the
   * RingCentral extension.
   */
  const user = await env.DB.prepare(
    `
    SELECT
      email,
      entra_user_id
    FROM staff_presence_status
    WHERE ringcentral_extension_id = ?
    LIMIT 1
  `,
  )
    .bind(extensionId)
    .first<{
      email: string;
      entra_user_id: string | null;
    }>();

  if (!user) {
    return {
      action: "ignored",
      reason: `No user found for RingCentral extension ${extensionId}.`,
    };
  }

  if (!user.entra_user_id) {
    return {
      action: "ignored",
      email: user.email,
      reason: "User does not have an Entra user ID.",
    };
  }

  /*
   * Connected RingCentral call:
   * establish our Teams presence session.
   */
  if (telephonyStatus === "CallConnected") {
    await setTeamsInCallPresence(env, user.entra_user_id);

    return {
      action: "set-in-call",
      email: user.email,
    };
  }

  /*
   * RingCentral reports no active call:
   * remove only OUR Teams presence session.
   */
  if (telephonyStatus === "NoCall") {
    await clearTeamsPresence(env, user.entra_user_id);

    return {
      action: "cleared",
      email: user.email,
    };
  }

  /*
   * Don't manipulate Teams for Ringing,
   * OnHold, etc. yet.
   */
  return {
    action: "ignored",
    email: user.email,
    reason: `No Teams rule exists for ${telephonyStatus ?? "undefined"}.`,
  };
}
