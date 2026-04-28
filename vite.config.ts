import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: null,
			includeAssets: ['icon.svg'],
			manifest: {
				name: 'Clear Backlog',
				short_name: 'Clear Backlog',
				description: 'Turn your backlog into digestible bytes, delivered as notifications.',
				theme_color: '#000000',
				background_color: '#ffffff',
				display: 'standalone',
				start_url: '/',
				icons: [
					{
						src: 'icon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any',
					},
					{
						src: 'icon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^\/api\//,
						handler: 'NetworkOnly',
					},
				],
			},
		}),
	],
});
