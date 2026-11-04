window.__ModuleLoader__.load({
  id: 'box-select-copy',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'box-select-copy';
    const MIN_DRAG = 4;
    const LINE_TOLERANCE = 10;
    const CELL_GAP = 12;
    const TOAST_MS = 1600;

    const zh = {
      copied: '✅ 已复制',
      empty: '未选中文本',
      failed: '复制失败',
    };
    const en = {
      copied: '✅ Copied',
      empty: 'Nothing selected',
      failed: 'Copy failed',
    };

    function normalizeRect(x1, y1, x2, y2) {
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      return {
        left,
        top,
        right: Math.max(x1, x2),
        bottom: Math.max(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      };
    }

    function overlaps(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function isElement(node) {
      return node !== null && node.nodeType === 1;
    }

    function findTextRoot(target) {
      let element = isElement(target) ? target : target && target.parentElement;
      if (!element || !element.closest) return null;
      const flow = element.closest('[data-slot="conversation.chat.flow"]');
      if (flow) return flow;
      const scroller = element.closest('[data-conversation-scroll]');
      if (!scroller) return null;
      return scroller.querySelector('[data-slot="conversation.chat.flow"]') || scroller;
    }

    function isSkippedElement(element) {
      const tag = element.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') return true;
      if (tag === 'SVG' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return true;
      if (element.getAttribute('aria-hidden') === 'true') return true;
      if (element.hasAttribute('data-box-select-ui')) return true;
      return false;
    }

    function extractTextInRect(root, rect) {
      const doc = root.ownerDocument;
      const win = doc.defaultView;
      if (!win) return '';
      const range = doc.createRange();
      const chars = [];

      function pushChar(ch, r) {
        if (r.width === 0 && r.height === 0) return;
        if (!overlaps(r, rect)) return;
        chars.push({
          ch,
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          height: r.height,
        });
      }

      function charRect(node, index) {
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        return range.getBoundingClientRect();
      }

      function collectTextNode(node) {
        const text = node.nodeValue;
        if (!text || !text.trim()) return;
        range.selectNodeContents(node);
        let intersects = false;
        for (const r of range.getClientRects()) {
          if (overlaps(r, rect)) {
            intersects = true;
            break;
          }
        }
        if (!intersects) return;

        let first = 0;
        let last = text.length - 1;
        if (text.length > 1200) {
          let lo = 0;
          let hi = text.length - 1;
          first = -1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const r = charRect(node, mid);
            if (r.bottom >= rect.top) {
              first = mid;
              hi = mid - 1;
            } else {
              lo = mid + 1;
            }
          }
          if (first < 0) return;
          lo = first;
          hi = text.length - 1;
          last = first;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const r = charRect(node, mid);
            if (r.top <= rect.bottom) {
              last = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
        }

        let i = first;
        while (i <= last) {
          const code = text.charCodeAt(i);
          if (code >= 0xdc00 && code <= 0xdfff && i > 0) {
            const prev = text.charCodeAt(i - 1);
            if (prev >= 0xd800 && prev <= 0xdbff) {
              i += 1;
              continue;
            }
          }
          const cp = text.codePointAt(i);
          const size = cp !== undefined && cp > 0xffff ? 2 : 1;
          const ch = text.slice(i, i + size);
          if (ch !== '\n' && ch !== '\r' && ch !== '\u200b') {
            pushChar(ch, charRect(node, i));
          }
          i += size;
        }
      }

      function walk(element) {
        for (let child = element.firstChild; child; child = child.nextSibling) {
          if (child.nodeType === 3) {
            collectTextNode(child);
            continue;
          }
          if (!isElement(child)) continue;
          if (isSkippedElement(child)) continue;
          const style = win.getComputedStyle(child);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const box = child.getBoundingClientRect();
          if (box.width === 0 && box.height === 0) {
            if (style.display === 'contents') walk(child);
            continue;
          }
          if (!overlaps(box, rect)) continue;
          walk(child);
        }
      }

      walk(root);

      chars.sort((a, b) => a.top - b.top || a.left - b.left);

      const lines = [];
      for (const c of chars) {
        const line = lines[lines.length - 1];
        if (!line || Math.abs(c.top - line.top) > LINE_TOLERANCE) {
          lines.push({ top: c.top, chars: [c] });
        } else {
          line.chars.push(c);
        }
      }

      const textLines = [];
      for (const line of lines) {
        line.chars.sort((a, b) => a.left - b.left);
        let output = '';
        let previous = null;
        for (const c of line.chars) {
          if (previous) {
            const gap = c.left - previous.right;
            if (
              gap > CELL_GAP &&
              output.length > 0 &&
              !/\s$/.test(output) &&
              !/^\s/.test(c.ch)
            ) {
              output += '\t';
            }
          }
          output += c.ch;
          previous = c;
        }
        output = output.replace(/[ \t]+$/, '');
        if (output.length > 0) textLines.push(output);
      }

      return textLines.join('\n');
    }

    async function writeClipboard(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (error) {
        /* fall through to the selection-based path */
      }
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.left = '-1000px';
        area.style.opacity = '0';
        area.style.pointerEvents = 'none';
        document.body.appendChild(area);
        area.select();
        area.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      } catch (error) {
        return false;
      }
    }

    function BoxSelectOverlay({ t }) {
      const translate = typeof t === 'function' ? t : (key) => key;
      const translateRef = React.useRef(translate);
      translateRef.current = translate;

      const [drag, setDrag] = React.useState(null);
      const [toast, setToast] = React.useState(null);
      const dragRef = React.useRef(null);

      const showToast = React.useCallback((message) => {
        setToast({ message, key: Date.now() });
      }, []);

      React.useEffect(() => {
        if (!toast) return undefined;
        const timer = window.setTimeout(() => setToast(null), TOAST_MS);
        return () => window.clearTimeout(timer);
      }, [toast]);

      React.useEffect(() => {
        const releaseCapture = (state) => {
          if (!state || !state.captureTarget) return;
          try {
            if (state.captureTarget.hasPointerCapture(state.pointerId)) {
              state.captureTarget.releasePointerCapture(state.pointerId);
            }
          } catch (error) {
            /* the target may already be gone */
          }
        };

        const cancel = () => {
          const state = dragRef.current;
          if (!state) return;
          releaseCapture(state);
          dragRef.current = null;
          setDrag(null);
        };

        const onPointerDown = (event) => {
          if (!event.altKey || event.button !== 0) return;
          if (!event.isPrimary) return;
          const target = isElement(event.target) ? event.target : null;
          if (!target) return;
          if (target.closest('[data-box-select-ui]')) return;
          const root = findTextRoot(target);
          if (!root) return;

          event.preventDefault();
          event.stopPropagation();
          setToast(null);
          const selection = window.getSelection();
          if (selection) selection.removeAllRanges();

          const state = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            root,
            active: false,
            rect: null,
            captureTarget: target,
          };
          try {
            target.setPointerCapture(event.pointerId);
          } catch (error) {
            state.captureTarget = null;
          }
          dragRef.current = state;
        };

        const onPointerMove = (event) => {
          const state = dragRef.current;
          if (!state || event.pointerId !== state.pointerId) return;
          if (!state.active) {
            if (Math.abs(event.clientX - state.startX) < MIN_DRAG &&
                Math.abs(event.clientY - state.startY) < MIN_DRAG) {
              return;
            }
            state.active = true;
          }
          event.preventDefault();
          const rect = normalizeRect(state.startX, state.startY, event.clientX, event.clientY);
          state.rect = rect;
          setDrag({ rect });
        };

        const finish = async (event, cancelled) => {
          const state = dragRef.current;
          if (!state || event.pointerId !== state.pointerId) return;
          dragRef.current = null;
          releaseCapture(state);
          setDrag(null);
          if (cancelled || !state.active || !state.rect) return;

          let text = '';
          try {
            text = extractTextInRect(state.root, state.rect);
          } catch (error) {
            console.error('[box-select-copy] failed to extract text', error);
          }
          if (!text) {
            showToast(translateRef.current('empty'));
            return;
          }
          const copied = await writeClipboard(text);
          showToast(translateRef.current(copied ? 'copied' : 'failed'));
        };

        const onPointerUp = (event) => {
          void finish(event, false);
        };

        const onPointerCancel = (event) => {
          void finish(event, true);
        };

        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return;
          if (!dragRef.current) return;
          cancel();
        };

        const onBlur = () => {
          if (dragRef.current) cancel();
        };

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointercancel', onPointerCancel, true);
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('blur', onBlur);
        return () => {
          releaseCapture(dragRef.current);
          dragRef.current = null;
          window.removeEventListener('pointerdown', onPointerDown, true);
          window.removeEventListener('pointermove', onPointerMove, true);
          window.removeEventListener('pointerup', onPointerUp, true);
          window.removeEventListener('pointercancel', onPointerCancel, true);
          window.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('blur', onBlur);
        };
      }, [showToast]);

      const children = [];
      if (drag) {
        children.push(h('div', {
          key: 'marquee',
          'data-box-select-ui': '',
          style: {
            position: 'fixed',
            left: `${drag.rect.left}px`,
            top: `${drag.rect.top}px`,
            width: `${drag.rect.width}px`,
            height: `${drag.rect.height}px`,
            boxSizing: 'border-box',
            border: '1px solid var(--dsw-alias-brand-primary, #4d6bfe)',
            background: 'color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 12%, transparent)',
            borderRadius: '2px',
            pointerEvents: 'none',
            zIndex: 2147483000,
          },
        }));
      }
      if (toast) {
        children.push(h('div', {
          key: 'toast',
          'data-box-select-ui': '',
          role: 'status',
          'aria-live': 'polite',
          style: {
            position: 'fixed',
            left: '50%',
            bottom: '120px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            maxWidth: 'min(320px, calc(100vw - 48px))',
            padding: '7px 14px',
            borderRadius: '999px',
            border: '1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.28))',
            background: 'var(--dsw-alias-bg-layer-1, rgba(32, 33, 36, 0.96))',
            color: 'var(--dsw-alias-label-primary, #f2f3f5)',
            transform: 'translateX(-50%)',
            boxShadow: 'var(--dsw-elevation-panel, 0 8px 28px rgba(0, 0, 0, 0.28))',
            font: 'var(--dsw-font-xs-strong-13, 13px/1.4 system-ui, sans-serif)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 2147483001,
            animation: 'dsh-box-select-copy-toast-in 140ms ease-out',
          },
        }, toast.message));
      }

      children.push(h('style', {
        key: 'style',
        children: '@keyframes dsh-box-select-copy-toast-in{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}',
      }));

      return h(React.Fragment, null, children);
    }

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'box-select-copy: dictionaries',
      );
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'box-select-copy',
        order: 50,
        locale: NS,
      }, BoxSelectOverlay));
    }

    const result = { inject: ['slots', 'locale'], apply };
    if (window.__DSH_BOX_SELECT_COPY_TEST__) {
      result.__test = { extractTextInRect, normalizeRect };
    }
    return result;
  },
});
