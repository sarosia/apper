/**
 * @sarosia/apper - Client Dashboard UI Utilities
 */

const DEFAULT_TAG_COLORS = [
  'source-tag-blue',
  'source-tag-green',
  'source-tag-purple',
  'source-tag-amber',
  'source-tag-rose',
];

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Shortens a URL string for friendly inline display.
 * @param {string} rawUrl
 * @param {number} maxLength
 * @returns {string}
 */
export function shortenUrlText(rawUrl, maxLength = 35) {
  if (!rawUrl) return '';
  try {
    const urlObj = new URL(rawUrl);
    if (rawUrl.length <= maxLength) {
      return rawUrl;
    }
    const path = urlObj.pathname !== '/' ? urlObj.pathname : '';
    let display = urlObj.hostname + path;
    if (display.length > maxLength) {
      display = display.substring(0, maxLength - 3) + '...';
    }
    return display;
  } catch {
    if (rawUrl.length > maxLength) {
      return `${rawUrl.slice(0, maxLength - 3)}...`;
    }
    return rawUrl;
  }
}

/**
 * Converts URLs in plain text into safe HTML anchor tags.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function formatTextWithLinks(text, maxLength = 35) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s<>"|]+)/g;
  let lastIndex = 0;
  let html = '';
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    html += escapeHtml(before);

    let rawUrl = match[0];
    let trailing = '';
    while (rawUrl.length > 0 && /[,.:;!?)]$/.test(rawUrl)) {
      trailing = rawUrl.slice(-1) + trailing;
      rawUrl = rawUrl.slice(0, -1);
    }
    if (rawUrl.endsWith("'") && !rawUrl.includes("'/'")) {
      trailing = "'" + trailing;
      rawUrl = rawUrl.slice(0, -1);
    }

    const display = shortenUrlText(rawUrl, maxLength);
    html += `<a href="${escapeHtml(rawUrl)}" target="_blank" rel="noopener noreferrer" class="event-link" title="${escapeHtml(rawUrl)}">${escapeHtml(display)}</a>`;
    html += escapeHtml(trailing);

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    html += escapeHtml(text.slice(lastIndex));
  }

  return html;
}

/**
 * Safely converts text nodes containing URLs into anchor links inside a DOM container.
 * @param {Document|HTMLElement} docOrRoot
 * @param {HTMLElement} [rootNode]
 * @param {number} [maxLength=35]
 */
export function linkifyTextNodes(docOrRoot, rootNode, maxLength = 35) {
  const doc = rootNode ? docOrRoot : (typeof document !== 'undefined' ? document : null);
  const root = rootNode ? rootNode : docOrRoot;
  if (!doc || !root) return;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (
        node.parentElement &&
        (node.parentElement.closest('a') ||
          node.parentElement.tagName === 'SCRIPT' ||
          node.parentElement.tagName === 'STYLE')
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  const urlRegex = /(https?:\/\/[^\s<>"|]+)/g;

  for (const node of textNodes) {
    const text = node.nodeValue;
    if (!text || !urlRegex.test(text)) continue;
    urlRegex.lastIndex = 0;

    const fragment = doc.createDocumentFragment();
    let lastIdx = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        fragment.appendChild(
          doc.createTextNode(text.slice(lastIdx, match.index))
        );
      }

      let rawUrl = match[0];
      let trailing = '';
      while (rawUrl.length > 0 && /[,.:;!?)]$/.test(rawUrl)) {
        trailing = rawUrl.slice(-1) + trailing;
        rawUrl = rawUrl.slice(0, -1);
      }
      if (rawUrl.endsWith("'") && !rawUrl.includes("'/'")) {
        trailing = "'" + trailing;
        rawUrl = rawUrl.slice(0, -1);
      }

      const a = doc.createElement('a');
      a.href = rawUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'event-link';
      a.title = rawUrl;
      a.textContent = shortenUrlText(rawUrl, maxLength);

      fragment.appendChild(a);
      if (trailing) {
        fragment.appendChild(doc.createTextNode(trailing));
      }

      lastIdx = match.index + match[0].length;
    }

    if (lastIdx < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIdx)));
    }

    node.parentNode.replaceChild(fragment, node);
  }
}

/**
 * Parses YYYY-MM-DD strings safely in local time.
 * @param {string} str
 * @returns {Date|null}
 */
export function parseDateOnly(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return null;
}

/**
 * Formats a Date object into a readable date string.
 * @param {Date} d
 * @param {boolean} [includeYear=false]
 * @returns {string}
 */
export function formatDate(d, includeYear = false) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const options = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };
  if (includeYear) {
    options.year = 'numeric';
  }
  return d.toLocaleDateString(undefined, options);
}

/**
 * Formats event start and end into a readable date/time range string.
 * Supports event object or individual arguments.
 */
export function formatEventDateTime(eventOrStart, endTimeParam, isAllDayParam) {
  let startTime;
  let endTime;
  let isAllDay;
  let startDateStr;
  let endDateStr;

  if (
    typeof eventOrStart === 'object' &&
    eventOrStart !== null &&
    !(eventOrStart instanceof Date)
  ) {
    startTime = eventOrStart.startTime;
    endTime = eventOrStart.endTime;
    isAllDay = eventOrStart.isAllDay;
    startDateStr = eventOrStart.startDate;
    endDateStr = eventOrStart.endDate;
  } else {
    startTime = eventOrStart;
    endTime = endTimeParam;
    isAllDay = isAllDayParam;
  }

  // Handle all-day with explicit YYYY-MM-DD to avoid timezone shifts
  if (isAllDay && startDateStr) {
    const start = parseDateOnly(startDateStr);
    const end = parseDateOnly(endDateStr) || start;
    let inclusiveEnd = end;
    if (end.getTime() > start.getTime()) {
      inclusiveEnd = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate() - 1
      );
    }
    const sameDay =
      start.getFullYear() === inclusiveEnd.getFullYear() &&
      start.getMonth() === inclusiveEnd.getMonth() &&
      start.getDate() === inclusiveEnd.getDate();

    if (sameDay) {
      return formatDate(start);
    }
    const diffYears = start.getFullYear() !== inclusiveEnd.getFullYear();
    return `${formatDate(start, diffYears)} - ${formatDate(inclusiveEnd, diffYears)}`;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime())) {
    return `${startTime || ''} - ${endTime || ''}`;
  }

  const startMidnight =
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    start.getSeconds() === 0;
  const endMidnight =
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0;

  const allDay =
    Boolean(isAllDay) ||
    (startMidnight && (endMidnight || end.getTime() === start.getTime()));

  if (allDay) {
    let inclusiveEnd = new Date(end);
    if (end.getTime() > start.getTime()) {
      inclusiveEnd = new Date(end.getTime() - 1000);
    }

    const sameDay =
      start.getFullYear() === inclusiveEnd.getFullYear() &&
      start.getMonth() === inclusiveEnd.getMonth() &&
      start.getDate() === inclusiveEnd.getDate();

    if (sameDay) {
      return formatDate(start);
    }
    const diffYears = start.getFullYear() !== inclusiveEnd.getFullYear();
    return `${formatDate(start, diffYears)} - ${formatDate(inclusiveEnd, diffYears)}`;
  }

  // Regular timed event
  const date = formatDate(start);
  const startStr = start.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endStr = end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${date}, ${startStr} - ${endStr}`;
  }
  const endDate = formatDate(end);
  return `${date}, ${startStr} - ${endDate}, ${endStr}`;
}

/**
 * Returns a deterministic color tag class for a given name.
 * @param {string} name
 * @param {string[]} [colors=DEFAULT_TAG_COLORS]
 * @returns {string}
 */
export function getTagClass(name, colors = DEFAULT_TAG_COLORS) {
  if (!name) return 'source-tag source-tag-default';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % colors.length;
  return `source-tag ${colors[idx]}`;
}

/**
 * Dispatches a UIkit notification toast if UIkit is loaded.
 * @param {string} message
 * @param {'primary'|'success'|'warning'|'danger'} [status='primary']
 * @param {object} [options={}]
 */
export function toast(message, status = 'primary', options = {}) {
  if (typeof window !== 'undefined' && window.UIkit && window.UIkit.notification) {
    window.UIkit.notification({
      message: String(message),
      status: status,
      pos: options.pos || 'top-right',
      timeout: options.timeout !== undefined ? options.timeout : 3000,
      ...options,
    });
  } else {
    console.log(`[Toast ${status}]`, message);
  }
}

/**
 * Debounce helper for input search and filtering.
 * @param {Function} func
 * @param {number} [wait=250]
 * @returns {Function}
 */
export function debounce(func, wait = 250) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const ApperUI = {
  escapeHtml,
  shortenUrlText,
  formatTextWithLinks,
  linkifyTextNodes,
  parseDateOnly,
  formatDate,
  formatEventDateTime,
  getTagClass,
  toast,
  debounce,
};

if (typeof window !== 'undefined') {
  window.ApperUI = ApperUI;
}

export default ApperUI;
