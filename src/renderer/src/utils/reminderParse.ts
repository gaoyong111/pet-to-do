import { ReminderType } from '../types';

/** 提醒自然语言解析结果 */
export interface ParsedReminder {
    title: string;
    type: ReminderType;
    time: string;
    date?: string;
}

/** 从自然语言文本解析提醒参数（供 /remind 与自然语言意图共用） */
export function parseReminderArgs(args: string): ParsedReminder {
    const now = new Date();
    let type: ReminderType = 'once';
    let time = '09:00';
    let date: string | undefined = undefined;
    let title = args;

    if (/每天/.test(title)) { type = 'daily'; title = title.replace(/每天/, ''); }
    if (/每周/.test(title)) { type = 'weekly'; title = title.replace(/每周/, ''); }
    if (/每月/.test(title)) { type = 'monthly'; title = title.replace(/每月/, ''); }

    if (/明天/.test(title)) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        date = tomorrow.toISOString().slice(0, 10);
        title = title.replace(/明天/, '');
    }
    if (/今天/.test(title)) {
        date = now.toISOString().slice(0, 10);
        title = title.replace(/今天/, '');
    }

    const timeMatch = title.match(/(下午|上午|中午)?(\d{1,2})[点:：](\d{1,2})?(半)?/);
    if (timeMatch) {
        let hour = parseInt(timeMatch[2]);
        const period = timeMatch[1];
        let minute = timeMatch[3] ? parseInt(timeMatch[3]) : (timeMatch[4] === '半' ? 30 : 0);

        if (period === '下午' && hour < 12) hour += 12;
        if (period === '中午' && hour < 12) hour += 12;
        if (period === '上午' && hour === 12) hour = 0;
        if (!period && hour <= 6 && hour >= 1) hour += 12;

        time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        title = title.replace(timeMatch[0], '');
    }

    title = title.replace(/^[\s,，、]+|[\s,，、]+$/g, '');

    return {
        title: title || args.replace(/[每天每周每月今天明天]/g, '').trim() || args,
        type,
        time,
        date: type === 'once' ? (date ?? now.toISOString().slice(0, 10)) : undefined,
    };
}
