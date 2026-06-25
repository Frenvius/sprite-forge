import type { Config } from 'tailwindcss';

export default {
	prefix: '',
	darkMode: ['class'],
	plugins: [require('tailwindcss-animate'), require('@tailwindcss/container-queries')],
	content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			boxShadow: {
				island: 'var(--island-shadow)',
				'island-lg': 'var(--island-shadow-lg)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			animation: {
				'accordion-up': 'accordion-up 0.2s ease-out',
				'accordion-down': 'accordion-down 0.2s ease-out'
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace']
			},
			keyframes: {
				'accordion-up': {
					to: {
						height: '0'
					},
					from: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				}
			},
			colors: {
				ring: 'hsl(var(--ring))',
				input: 'hsl(var(--input))',
				border: 'hsl(var(--border))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				'item-hover': 'hsl(var(--item-hover))',
				'toolbar-bg': 'hsl(var(--toolbar-bg))',
				'item-selected': 'hsl(var(--item-selected))',
				panel: {
					DEFAULT: 'hsl(var(--panel-bg))',
					border: 'hsl(var(--panel-border))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				sidebar: {
					ring: 'hsl(var(--sidebar-ring))',
					accent: 'hsl(var(--sidebar-accent))',
					border: 'hsl(var(--sidebar-border))',
					primary: 'hsl(var(--sidebar-primary))',
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))'
				}
			}
		}
	}
} satisfies Config;
