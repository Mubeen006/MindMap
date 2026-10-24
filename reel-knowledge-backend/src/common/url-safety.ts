import * as dns from 'dns';
import { promisify } from 'util';
import * as net from 'net';

const dnsLookup = promisify(dns.lookup);

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('That is not a valid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http:// and https:// links are allowed');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('Local addresses are not allowed');
  }

  let resolvedIp: string;
  try {
    const result = await dnsLookup(hostname);
    resolvedIp = result.address;
  } catch {
    throw new Error('Could not resolve that host');
  }

  if (isPrivateIp(resolvedIp)) {
    throw new Error('That URL points to a private/internal address and cannot be added');
  }

  return url;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}
