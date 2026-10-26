import { getRandomBytes } from 'expo-crypto';

function hex(value: number): string {
  return value.toString(16).padStart(2, '0');
}

/** RFC 9562 UUIDv7, sortable by millisecond creation time. */
export function uuidv7(now = Date.now(), random = getRandomBytes(10)): string {
  if (random.length < 10) throw new Error('UUIDv7 requires ten random bytes.');
  const timestamp = Math.trunc(now).toString(16).padStart(12, '0').slice(-12);
  const bytes = Array.from(random.slice(0, 10));
  bytes[0] = (bytes[0]! & 0x0f) | 0x70;
  bytes[2] = (bytes[2]! & 0x3f) | 0x80;
  const tail = bytes.map(hex).join('');
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-${tail.slice(0, 4)}-${tail.slice(4, 8)}-${tail.slice(8, 20)}`;
}
