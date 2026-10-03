/** Shown on the home page. Edit freely to match n8n Doctor's current feature list. */
export const FEATURE_GROUPS = [
  {
    icon: 'shield',
    title: 'Backup & disaster recovery',
    intro: 'Keep your n8n data safe and restorable.',
    items: [
      'Scheduled and on-demand backups of your n8n instances',
      'Sync backups to Google Drive or S3-compatible storage',
      'Verify backups and restore them when something goes wrong',
      'Backup history and notifications',
    ],
  },
  {
    icon: 'bolt',
    title: 'Instance management',
    intro: 'Run and monitor your n8n containers from one place.',
    items: [
      'Docker-based n8n instances managed from a desktop app',
      'Resource and workflow monitoring with diagnostics',
      'Built-in container terminal',
      'Instance integrity checks and capacity awareness',
    ],
  },
  {
    icon: 'globe',
    title: 'Public URLs',
    intro: 'Reach your instance from outside your network.',
    items: ['Temporary public tunnels for webhooks and testing', 'Cloudflare-based public access setup'],
  },
  {
    icon: 'key',
    title: 'Simple licensing',
    intro: 'A signed key that works offline.',
    items: [
      'Trial, monthly, 6-month and yearly plans',
      'Each key is tied to one computer (its Machine ID)',
      'Works offline: paste the key once, renew by pasting a new one',
      'Expiry reminders before your license ends',
    ],
  },
];
