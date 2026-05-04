// Smoke test for service-worker notification delivery + persistence.
//
// On click, schedules 5 notifications:
//   #1 immediately
//   #2 after 1 minute
//   #3 after 10 minutes
//   #4 after 1 hour
//   #5 after 3 hours
//
// Two scheduling paths, picked per-browser:
//
//   * Preferred: TimestampTrigger / showTrigger. Hands the schedule to the
//     browser itself — notifications fire even if the page is closed, the
//     SW is dormant, or the device is locked. Chrome desktop + Android only.
//
//   * Fallback: setTimeout in the main thread. Works while the page is open
//     and in the foreground. On mobile the OS will pause JS once the tab is
//     backgrounded, so longer-delay notifications won't fire on iOS Safari /
//     Firefox without TimestampTrigger.
//
// No backend involvement — purely a client-side test.

// TimestampTrigger / NotificationOptions.showTrigger aren't in the default TS
// libs yet. Declare a minimal shape so we can use them without `any`.
declare class TimestampTrigger {
	constructor(timestamp: number);
}

type ScheduledItem = {
	delayMs: number;
	delayLabel: string;
	title: string;
	body: string;
};

const SCHEDULE: ScheduledItem[] = [
	{
		delayMs: 0,
		delayLabel: 'immediate',
		title: 'Clear-Backlog test 1/5',
		body: 'Immediate. Fired the moment you clicked the test button.',
	},
	{
		delayMs: 60_000,
		delayLabel: '1m',
		title: 'Clear-Backlog test 2/5',
		body: 'Scheduled +1 minute after click.',
	},
	{
		delayMs: 10 * 60_000,
		delayLabel: '10m',
		title: 'Clear-Backlog test 3/5',
		body: 'Scheduled +10 minutes after click.',
	},
	{
		delayMs: 60 * 60_000,
		delayLabel: '1h',
		title: 'Clear-Backlog test 4/5',
		body: 'Scheduled +1 hour after click. Tests SW persistence.',
	},
	{
		delayMs: 3 * 60 * 60_000,
		delayLabel: '3h',
		title: 'Clear-Backlog test 5/5',
		body: 'Scheduled +3 hours after click. Tests long-term SW persistence.',
	},
];

function supportsShowTrigger(): boolean {
	if (typeof window === 'undefined') return false;
	if (!('Notification' in window)) return false;
	// `showTrigger` shows up as an own/inherited prop on NotificationOptions
	// when the runtime supports it. Feature-detect against the prototype.
	if (!('showTrigger' in Notification.prototype)) return false;
	return typeof (window as unknown as { TimestampTrigger?: unknown }).TimestampTrigger === 'function';
}

function buildOptions(item: ScheduledItem, useTrigger: boolean): NotificationOptions {
	const options: NotificationOptions & { showTrigger?: TimestampTrigger } = {
		body: item.body,
		icon: '/eyes-192.png',
		badge: '/eyes-192.png',
		tag: `cb-sw-test-${item.delayLabel}`,
		requireInteraction: false,
	};
	if (useTrigger && item.delayMs > 0) {
		options.showTrigger = new TimestampTrigger(Date.now() + item.delayMs);
	}
	return options;
}

export async function testServiceWorkerNotification(): Promise<boolean> {
	console.log('[sw-smoke] starting');

	if (!('serviceWorker' in navigator)) {
		console.error('[sw-smoke] FAIL: service workers not supported in this browser');
		return false;
	}
	if (!('Notification' in window)) {
		console.error('[sw-smoke] FAIL: notifications not supported in this browser');
		return false;
	}

	let permission = Notification.permission;
	console.log('[sw-smoke] permission state:', permission);

	if (permission === 'default') {
		console.log('[sw-smoke] requesting permission...');
		permission = await Notification.requestPermission();
		console.log('[sw-smoke] permission after request:', permission);
	}

	if (permission !== 'granted') {
		console.error('[sw-smoke] FAIL: permission is', permission);
		return false;
	}

	console.log('[sw-smoke] waiting for navigator.serviceWorker.ready...');
	const registration = await navigator.serviceWorker.ready;
	console.log('[sw-smoke] sw ready, scope:', registration.scope, 'active:', !!registration.active);

	const useTrigger = supportsShowTrigger();
	console.log(
		useTrigger
			? '[sw-smoke] using TimestampTrigger — scheduled notifications survive page close.'
			: '[sw-smoke] TimestampTrigger NOT supported (likely iOS Safari / Firefox); falling back to setTimeout. Long delays only fire if the page stays open.',
	);

	let scheduled = 0;
	let failed = 0;

	for (const item of SCHEDULE) {
		try {
			if (item.delayMs === 0) {
				// Always fire #1 immediately, regardless of trigger support.
				await registration.showNotification(item.title, buildOptions(item, false));
				console.log(`[sw-smoke] fired ${item.delayLabel}`);
				scheduled += 1;
				continue;
			}

			if (useTrigger) {
				await registration.showNotification(item.title, buildOptions(item, true));
				console.log(`[sw-smoke] scheduled ${item.delayLabel} via TimestampTrigger`);
				scheduled += 1;
			} else {
				const captured = item;
				window.setTimeout(async () => {
					try {
						const reg = await navigator.serviceWorker.ready;
						await reg.showNotification(captured.title, buildOptions(captured, false));
						console.log(`[sw-smoke] fired ${captured.delayLabel} via setTimeout`);
					} catch (err) {
						console.error(`[sw-smoke] setTimeout fire ${captured.delayLabel} threw`, err);
					}
				}, item.delayMs);
				console.log(`[sw-smoke] scheduled ${item.delayLabel} via setTimeout (page must stay open)`);
				scheduled += 1;
			}
		} catch (err) {
			failed += 1;
			console.error(`[sw-smoke] FAIL ${item.delayLabel}:`, err);
		}
	}

	console.log(
		`[sw-smoke] done. scheduled=${scheduled} failed=${failed} mechanism=${useTrigger ? 'TimestampTrigger' : 'setTimeout'}`,
	);
	return failed === 0;
}
