import { petEventBus, PetState } from '../eventBus';

/** 时间段配置 */
interface TimePeriod {
    /** 开始小时（24h） */
    startHour: number;
    /** 结束小时（24h） */
    endHour: number;
    /** 对应的桌宠状态 */
    state: PetState;
    /** 进入该时段时显示的气泡消息列表（随机选一条） */
    greetings: string[];
}

/** 默认时间段配置 */
const DEFAULT_PERIODS: TimePeriod[] = [
    {
        startHour: 0, endHour: 6,
        state: 'idle',
        greetings: ['好困啊...zzZ', '夜深了，早点休息吧~', '主人还不睡吗...']
    },
    {
        startHour: 6, endHour: 9,
        state: 'happy',
        greetings: ['早上好呀~', '新的一天开始啦！', '主人早安~']
    },
    {
        startHour: 9, endHour: 12,
        state: 'working',
        greetings: ['开始工作啦！', '加油加油~', '今天也要元气满满哦']
    },
    {
        startHour: 12, endHour: 14,
        state: 'happy',
        greetings: ['午饭时间到~', '记得吃饭哦~', '休息一下吧~']
    },
    {
        startHour: 14, endHour: 18,
        state: 'working',
        greetings: ['下午好~', '继续加油！', '来杯下午茶？']
    },
    {
        startHour: 18, endHour: 22,
        state: 'idle',
        greetings: ['下班啦~', '辛苦了一天！', '晚上想做什么呢？']
    },
    {
        startHour: 22, endHour: 24,
        state: 'idle',
        greetings: ['该休息了~', '晚安~', '明天见！']
    }
];

/** 是否启用时段自动状态/气泡（默认关；待状态机优先级设计后再开） */
export const TIME_SENSOR_ENABLED = false;

/** 检查间隔（毫秒） */
const CHECK_INTERVAL = 60_000;

/**
 * 时间感知模块
 *
 * 设计：按时间段切换桌宠状态 + 问候气泡。
 * 当前默认关闭——定时对话由 renderer `dialogueSystem` 的 DAILY_SCHEDULE 负责，
 * 状态切换待状态机优先级（番茄钟 / 手动 / 时段）设计完成后再启用。
 */
class TimeSensor {
    /** 时间段配置 */
    private periods: TimePeriod[];

    /** 定时检查器 */
    private timer: ReturnType<typeof setInterval> | null = null;

    /** 上一次匹配的时间段索引，避免重复触发 */
    private lastPeriodIndex: number = -1;

    /**
     * 创建时间感知模块
     * @param periods - 自定义时间段配置，默认使用内置配置
     */
    constructor(periods?: TimePeriod[]) {
        this.periods = periods || DEFAULT_PERIODS;
    }

    /**
     * 启动时间感知
     * 立即检查一次，然后每分钟检查一次
     */
    start(): void {
        if (!TIME_SENSOR_ENABLED) return;
        if (this.timer) return;

        this.check();
        this.timer = setInterval(() => {
            this.check();
        }, CHECK_INTERVAL);
    }

    /**
     * 停止时间感知
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.lastPeriodIndex = -1;
    }

    /**
     * 检查当前时间段并触发对应事件
     */
    private check(): void {
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;

        const index = this.findPeriodIndex(currentHour);
        if (index === -1 || index === this.lastPeriodIndex) return;

        this.lastPeriodIndex = index;
        const period = this.periods[index];

        // 切换状态
        petEventBus.setState(period.state);

        // 随机选一条问候语
        const greeting = period.greetings[Math.floor(Math.random() * period.greetings.length)];
        petEventBus.showBubble(greeting, 4000, 'emotion');
    }

    /**
     * 查找当前时间段索引
     * @param hour - 当前小时（含小数）
     * @returns 时间段索引，-1 表示未找到
     */
    private findPeriodIndex(hour: number): number {
        for (let i = 0; i < this.periods.length; i++) {
            const p = this.periods[i];
            if (p.startHour <= hour && hour < p.endHour) {
                return i;
            }
        }
        return -1;
    }
}

export { TimeSensor };
export type { TimePeriod };
