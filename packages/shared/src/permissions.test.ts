import { describe, expect, it } from 'vitest';
import { isPermissionKey, PERMISSION_KEYS, SYSTEM_ROLES } from './permissions';

describe('permissions', () => {
  it('has unique dotted keys', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    expect(PERMISSION_KEYS.every((k) => k.includes('.'))).toBe(true);
  });

  it('validates keys', () => {
    expect(isPermissionKey('pos.order.void')).toBe(true);
    expect(isPermissionKey('toString')).toBe(false);
  });

  it('gives the owner every permission and cashier no void', () => {
    const owner = SYSTEM_ROLES.find((r) => r.name === 'Owner');
    const cashier = SYSTEM_ROLES.find((r) => r.name === 'Cashier');
    expect(owner?.permissions).toHaveLength(PERMISSION_KEYS.length);
    expect(cashier?.permissions).not.toContain('pos.order.void');
  });
});
