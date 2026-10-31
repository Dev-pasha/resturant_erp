export const PERMISSIONS = {
  'pos.order.create': 'Create orders',
  'pos.order.edit_after_kot': 'Edit order after it was sent to kitchen',
  'pos.order.void': 'Void lines and orders',
  'pos.order.reopen': 'Reopen a closed bill',
  'pos.discount.apply': 'Apply discounts (up to role limit)',
  'pos.payment.take': 'Take payments',
  'pos.refund': 'Issue refunds',
  'pos.shift.open_close': 'Open and close shifts and business day',
  'pos.cash.drop': 'Cash drops and payouts',
  'pos.price.override': 'Override item prices',
  'kds.view': 'Use kitchen display',
  'menu.manage': 'Manage menu and recipes',
  'inventory.view': 'View inventory',
  'inventory.adjust': 'Adjust stock, record wastage and production',
  'inventory.count': 'Perform and approve stock counts',
  'purchase.create': 'Create purchase orders',
  'purchase.approve': 'Approve purchase orders',
  'purchase.receive': 'Receive goods and returns',
  'supplier.pay': 'Pay suppliers',
  'expense.manage': 'Manage expenses',
  'reports.sales': 'View sales reports',
  'reports.cost': 'View cost prices and profit',
  'reports.financial': 'View financial reports',
  'staff.manage': 'Manage users, roles and employees',
  'settings.manage': 'Manage settings, branches and devices',
  'branding.manage': 'Manage branding',
  'online.manage': 'Manage online and QR orders',
  'customers.view': 'View customers',
  'audit.view': 'View audit log',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.hasOwn(PERMISSIONS, value);
}

export interface SystemRoleDefinition {
  name: string;
  maxDiscountPercent: number;
  permissions: readonly PermissionKey[];
}

/**
 * Proposed defaults for the system roles created per tenant (PRD §3 gives only
 * the typical use of each role). Tenants can edit them. To be confirmed before M1.
 */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  { name: 'Owner', maxDiscountPercent: 100, permissions: PERMISSION_KEYS },
  {
    name: 'Manager',
    maxDiscountPercent: 50,
    permissions: PERMISSION_KEYS.filter(
      (k) => !['staff.manage', 'branding.manage', 'supplier.pay', 'reports.financial'].includes(k),
    ),
  },
  {
    name: 'Cashier',
    maxDiscountPercent: 10,
    permissions: [
      'pos.order.create',
      'pos.discount.apply',
      'pos.payment.take',
      'pos.shift.open_close',
      'pos.cash.drop',
      'customers.view',
    ],
  },
  { name: 'Waiter', maxDiscountPercent: 0, permissions: ['pos.order.create'] },
  { name: 'Kitchen', maxDiscountPercent: 0, permissions: ['kds.view'] },
  {
    name: 'Storekeeper',
    maxDiscountPercent: 0,
    permissions: [
      'inventory.view',
      'inventory.adjust',
      'inventory.count',
      'purchase.create',
      'purchase.receive',
    ],
  },
  {
    name: 'Accountant',
    maxDiscountPercent: 0,
    permissions: [
      'expense.manage',
      'supplier.pay',
      'reports.sales',
      'reports.cost',
      'reports.financial',
      'inventory.view',
    ],
  },
];
