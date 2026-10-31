import { uuidv7 } from 'uuidv7';

/** UUIDv7 id; safe to generate on the client (offline POS). */
export function newId(): string {
  return uuidv7();
}
