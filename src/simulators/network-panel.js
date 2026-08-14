import { el } from '../utils/dom.js';
import { truncate } from '../utils/format.js';

/**
 * Renders accumulated network log entries emitted by the sandbox's mocked fetch/XHR/
 * sendBeacon layer as a DevTools-style table. `isSuspicious(entry)` lets a mission
 * flag rows worth investigating (e.g. a destination host outside an allowlist).
 */
export function renderNetworkTable(entries, isSuspicious = () => false) {
  if (!entries || entries.length === 0) {
    return el('p', { class: 'empty-state' }, 'No network activity yet.');
  }

  const rows = entries.map((entry) =>
    el('tr', { class: isSuspicious(entry) ? 'network-row--suspicious' : '' }, [
      el('td', {}, entry.api ?? ''),
      el('td', {}, entry.method ?? ''),
      el('td', { title: entry.url }, truncate(entry.url ?? '', 42)),
      el('td', {}, entry.status != null ? String(entry.status) : entry.phase === 'response' ? '' : 'pending'),
      el('td', { title: entry.requestBody ? String(entry.requestBody) : '' }, truncate(entry.requestBody ? String(entry.requestBody) : '', 30)),
    ])
  );

  return el('table', { class: 'network-table' }, [
    el('thead', {}, el('tr', {}, ['API', 'Method', 'URL', 'Status', 'Body'].map((h) => el('th', {}, h)))),
    el('tbody', {}, rows),
  ]);
}
