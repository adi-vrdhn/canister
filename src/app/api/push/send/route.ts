import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminDatabase, getFirebaseAdminMessaging } from "@/lib/firebase-admin";
import { mergeSettings, notificationPreferenceForType, type NotificationType } from "@/lib/settings";

type PushSendBody = {
  userId?: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  type?: string;
  notificationId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PushSendBody;
    const userId = body.userId?.trim();
    const title = body.title?.trim();
    const messageBody = body.body?.trim();

    if (!userId || !title || !messageBody) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }

    const db = getFirebaseAdminDatabase();
    const [userSnapshot, tokensSnapshot] = await Promise.all([
      db.ref(`users/${userId}`).get(),
      db.ref(`users/${userId}/push_tokens`).get(),
    ]);

    const settings = mergeSettings(userSnapshot.exists() ? userSnapshot.val()?.settings : null);
    if (!settings.notifications.pushNotifications) {
      return NextResponse.json({ ok: true, skipped: "push-disabled" });
    }

    if (body.type) {
      const preferenceKey = notificationPreferenceForType(body.type as NotificationType);
      if (!settings.notifications[preferenceKey]) {
        return NextResponse.json({ ok: true, skipped: `${preferenceKey}-disabled` });
      }
    }

    if (!tokensSnapshot.exists()) {
      return NextResponse.json({ ok: true, skipped: "no-tokens" });
    }

    const tokens = Object.entries(tokensSnapshot.val() as Record<string, { token?: string }>)
      .map(([key, value]) => ({ key, token: value?.token?.trim() || "" }))
      .filter((entry): entry is { key: string; token: string } => Boolean(entry.token));

    if (tokens.length === 0) {
      return NextResponse.json({ ok: true, skipped: "no-tokens" });
    }

    const messaging = getFirebaseAdminMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((entry) => entry.token),
      notification: {
        title,
        body: messageBody,
      },
      data: {
        url: body.url || "/notifications",
        tag: body.tag || body.notificationId || body.type || "canisterr",
        type: body.type || "general",
        notificationId: body.notificationId || "",
      },
      webpush: {
        fcmOptions: {
          link: body.url || "/notifications",
        },
      },
    });

    const removals: Promise<unknown>[] = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const errorCode = result.error?.code || "";
      if (errorCode.includes("registration-token-not-registered") || errorCode.includes("invalid-registration-token")) {
        removals.push(db.ref(`users/${userId}/push_tokens/${tokens[index].key}`).remove());
      }
    });

    if (removals.length > 0) {
      await Promise.all(removals);
    }

    return NextResponse.json({
      ok: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error("Push send route failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send push notification.",
      },
      { status: 500 }
    );
  }
}
