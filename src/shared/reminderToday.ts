import type { Reminder } from './types';

/** 本地日期 YYYY-MM-DD */
export function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 是否与主进程 checkReminders 一致：今天还会触发（不含具体分钟）
 */
export function isReminderScheduledForToday(reminder: Reminder, now = new Date()): boolean {
  if (!reminder.enabled) return false;

  const currentDate = getLocalDateString(now);
  const currentWeekDay = now.getDay();
  const currentMonthDay = now.getDate();

  switch (reminder.type) {
    case 'once':
      return reminder.date === currentDate;
    case 'daily':
      return reminder.lastTriggered !== currentDate;
    case 'weekly':
      return !!(
        reminder.weekDays?.includes(currentWeekDay)
        && reminder.lastTriggered !== currentDate
      );
    case 'monthly':
      return reminder.monthDay === currentMonthDay
        && reminder.lastTriggered !== currentDate;
    default:
      return false;
  }
}

export function countRemindersScheduledForToday(reminders: Reminder[], now = new Date()): number {
  return reminders.filter(r => isReminderScheduledForToday(r, now)).length;
}
