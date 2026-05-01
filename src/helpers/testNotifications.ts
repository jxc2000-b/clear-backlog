export async function testServiceWorkerNotification() {
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

	try {
		await registration.showNotification('Clear-Backlog smoke test', {
			body: 'If you see this, the service worker can deliver notifications.',
			icon: '/eyes-192.png',
			badge: '/eyes-192.png',
			tag: 'cb-sw-smoke',
			requireInteraction: false,
		});
		console.log('[sw-smoke] PASS: showNotification resolved');
		return true;
	} catch (err) {
		console.error('[sw-smoke] FAIL: showNotification threw', err);
		return false;
	}
}
