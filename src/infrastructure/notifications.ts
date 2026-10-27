import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  markNotificationFailed,
  markNotificationCancelled,
  markNotificationRegistered,
  notificationReconciliation,
  type ConfirmationRecord,
} from './database';
import { recordDiagnostic } from './diagnostics';
import { deviceTimeZone, instantToDate } from '@/domain/time';
import { activeScheduledItemIds, markStoredMissedOccurrences, materializeOccurrences } from './schedule-repository';

const CHANNEL_ID = 'reminders';
const RECONCILIATION_HORIZON_DAYS = 30;
const REGISTRATION_CAP = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name : 'notification_error';
}

export async function prepareNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 150, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  return permission.granted;
}

async function register(
  registrationId: string,
  title: string,
  scheduledAtUtc: string,
): Promise<string> {
  const identifier = await Notifications.scheduleNotificationAsync({
    identifier: registrationId,
    content: {
      title,
      body: 'Reminder',
      sound: 'default',
      data: { registrationId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: instantToDate(scheduledAtUtc),
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
  await markNotificationRegistered(registrationId, identifier);
  return identifier;
}

export async function scheduleConfirmedReminder(record: ConfirmationRecord): Promise<string> {
  const started = performance.now();
  try {
    if (!(await prepareNotifications())) throw new Error('notification_permission_denied');
    const identifier = await register(record.registrationId, record.title, record.scheduledAtUtc);
    await recordDiagnostic({
      category: 'notification',
      engine: 'platform',
      durationMs: Math.round(performance.now() - started),
      resultKind: 'success',
    });
    return identifier;
  } catch (error) {
    await markNotificationFailed(record.registrationId, errorCode(error));
    await recordDiagnostic({
      category: 'notification',
      engine: 'platform',
      durationMs: Math.round(performance.now() - started),
      resultKind: 'failure',
      errorCode: errorCode(error),
    });
    throw error;
  }
}

export async function reconcileNotifications(): Promise<number> {
  const now = new Date();
  const nowUtc = now.toISOString();
  const horizonUtc = new Date(now.getTime() + RECONCILIATION_HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (const itemId of await activeScheduledItemIds()) {
    await materializeOccurrences(itemId, nowUtc, horizonUtc, deviceTimeZone());
  }
  await markStoredMissedOccurrences(nowUtc);
  let desired = await notificationReconciliation(nowUtc, REGISTRATION_CAP);
  for (const obsolete of desired.cancel) {
    await Notifications.cancelScheduledNotificationAsync(obsolete.platform_identifier);
    await markNotificationCancelled(obsolete.id, obsolete.remains_desired === 1, nowUtc);
  }
  if (desired.cancel.some((row) => row.remains_desired === 1)) {
    desired = await notificationReconciliation(nowUtc, REGISTRATION_CAP);
  }
  if (desired.register.length > 0) {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return 0;
    await prepareNotifications();
  }
  let registered = 0;
  for (const row of desired.register) {
    try {
      await register(row.id, row.title, row.desired_at_utc);
      registered += 1;
    } catch (error) {
      await markNotificationFailed(row.id, errorCode(error));
    }
  }
  return registered;
}

export async function cancelNotification(identifier: string | null): Promise<void> {
  if (identifier) await Notifications.cancelScheduledNotificationAsync(identifier);
}
