export const TENANT_STATUSES = ['trial', 'active', 'suspended', 'cancelled'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const DEVICE_TYPES = ['pos', 'waiter', 'kds', 'print_agent'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const ORDER_CHANNELS = ['pos', 'qr', 'online'] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery', 'pickup'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];
