import { randomBytes } from 'crypto';

export type ReplaceableVariables = { varName: string; varValue: string };

export type PluginSettings = {
  port: number;
  defaultFile: string;
  hostname: string;
  /**
   * Public-facing base URL for links rendered to the browser (useful when served behind a reverse proxy).
   * Examples:
   * - "" (default): use root-relative URLs (current behavior)
   * - "/obsidian": served behind a proxy prefix
   * - "https://example.com/obsidian": full public URL
   */
  frontendBaseUrl: string;
  /**
   * Base URL used by browser-side requests back to this server (e.g. /login).
   * Usually same as frontendBaseUrl. Kept separate for proxy setups where browser-accessible origin differs.
   */
  backendBaseUrl: string;
  startOnLoad: boolean;
  useRibbonButons: boolean;
  indexHtml: string;
  htmlReplaceableVariables: ReplaceableVariables[];
  showAdvancedOptions: boolean;
  useSimpleAuth: boolean;
  simpleAuthUsername: string;
  simpleAuthPassword: string;
};

export const DEFAULT_SETTINGS: PluginSettings = {
  port: 8080,
  hostname: '0.0.0.0',
  defaultFile: '',
  frontendBaseUrl: '',
  backendBaseUrl: '',
  startOnLoad: false,
  useRibbonButons: true,
  indexHtml: `<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>#VAR{HTML_TITLE}</title>
  <link rel="shortcut icon" href="#VAR{FAVICON_URL}">
  <link href="#VAR{CSS_FILE_URL}" type="text/css" rel="stylesheet">
  <base href="#VAR{BASE_HREF}">
  <style>
    /* Lightweight outline panel that follows Obsidian theme variables. */
    .html-outline-panel {
      position: fixed;
      top: calc(var(--header-height, 0px) + 12px);
      right: 12px;
      width: min(320px, calc(100vw - 24px));
      max-height: calc(100vh - 24px);
      overflow: auto;
      z-index: 20;
      border: 1px solid var(--background-modifier-border, rgba(0,0,0,.2));
      border-radius: 10px;
      background: var(--background-primary, #111);
      box-shadow: 0 10px 30px rgba(0,0,0,.25);
      padding: 10px;
      font-size: 13px;
    }
    .html-outline-panel[hidden] { display: none !important; }
    .html-outline-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0 0 8px 0;
      font-weight: 600;
      color: var(--text-normal, #ddd);
    }
    .html-outline-toggle {
      appearance: none;
      border: 1px solid var(--background-modifier-border, rgba(0,0,0,.2));
      background: var(--background-secondary, #222);
      color: var(--text-muted, #bbb);
      border-radius: 8px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
    }
    .html-outline {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .html-outline a {
      display: block;
      text-decoration: none;
      color: var(--text-muted, #bbb);
      padding: 4px 6px;
      border-radius: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .html-outline a:hover {
      background: var(--background-modifier-hover, rgba(255,255,255,.06));
      color: var(--text-normal, #ddd);
    }
    .html-outline a[data-active="true"] {
      background: var(--background-modifier-active-hover, rgba(255,255,255,.1));
      color: var(--text-normal, #fff);
      font-weight: 600;
    }
    .html-outline li { margin: 0; padding: 0; }
    .html-outline li[data-level="2"] a { padding-left: 14px; }
    .html-outline li[data-level="3"] a { padding-left: 22px; }
    .html-outline li[data-level="4"] a { padding-left: 30px; }
    .html-outline li[data-level="5"] a { padding-left: 38px; }
    .html-outline li[data-level="6"] a { padding-left: 46px; }
    @media (max-width: 900px) {
      .html-outline-panel {
        position: static;
        width: auto;
        max-height: none;
        margin: 10px 12px 0 12px;
      }
    }

    /* File navigation tree (left) */
    .html-nav-panel {
      position: fixed;
      left: 0;
      top: 0;
      height: 100vh;
      width: 280px;
      z-index: 19;
      background: var(--background-primary, #111);
      border-right: 1px solid var(--background-modifier-border, rgba(0,0,0,.2));
      display: flex;
      flex-direction: column;
      padding: 10px 10px 12px 10px;
      box-sizing: border-box;
    }
    body.html-has-nav .horizontal-main-container {
      padding-left: 280px;
      box-sizing: border-box;
    }
    .html-nav-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0 0 8px 0;
      color: var(--text-normal, #ddd);
      font-weight: 600;
      font-size: 13px;
    }
    .html-nav-search {
      width: 100%;
      border: 1px solid var(--background-modifier-border, rgba(0,0,0,.2));
      background: var(--background-secondary, #222);
      color: var(--text-normal, #ddd);
      border-radius: 8px;
      padding: 6px 8px;
      font-size: 12px;
      outline: none;
      margin-bottom: 8px;
    }
    .html-nav-tree {
      overflow: auto;
      padding-right: 6px;
      flex: 1 1 auto;
    }
    .html-tree-item {
      display: block;
      border-radius: 8px;
      padding: 4px 6px;
      color: var(--text-muted, #bbb);
      font-size: 12px;
      user-select: none;
    }
    .html-tree-item:hover {
      background: var(--background-modifier-hover, rgba(255,255,255,.06));
      color: var(--text-normal, #ddd);
    }
    .html-tree-item[data-active="true"] {
      background: var(--background-modifier-active-hover, rgba(255,255,255,.1));
      color: var(--text-normal, #fff);
      font-weight: 600;
    }
    .html-tree-folder {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .html-tree-folder::before { content: "▸"; width: 12px; display: inline-block; }
    .html-tree-folder[data-open="true"]::before { content: "▾"; }
    .html-tree-children {
      margin-left: 14px;
      padding-left: 6px;
      border-left: 1px dashed var(--background-modifier-border, rgba(0,0,0,.2));
    }
    .html-tree-children[hidden] { display: none !important; }
    @media (max-width: 900px) {
      .html-nav-panel {
        position: static;
        width: auto;
        height: auto;
        padding: 10px 12px;
        border-right: none;
        border-bottom: 1px solid var(--background-modifier-border, rgba(0,0,0,.2));
      }
      body.html-has-nav .horizontal-main-container {
        padding-left: 0;
      }
    }
  </style>
</head>
<body
  class="#VAR{THEME_MODE} mod-windows is-frameless is-maximized is-hidden-frameless obsidian-app show-inline-title show-view-header"
  style="--zoom-factor:1; --font-text-size:16px;">
  <aside class="html-nav-panel" id="htmlNavPanel">
    <div class="html-nav-header">
      <span>Files</span>
      <button class="html-outline-toggle" id="htmlNavToggle" type="button">Hide</button>
    </div>
    <input class="html-nav-search" id="htmlNavSearch" placeholder="Search files…" />
    <div class="html-nav-tree" id="htmlNavTree"></div>
  </aside>
  <div class="app-container">
    <div class="horizontal-main-container">
      <div class="workspace">
        <div class="workspace-split mod-vertical mod-root">
          <div class="workspace-tabs mod-top mod-top-left-space mod-top-right-space">
            <div class="workspace-tab-container">
              <div class="workspace-leaf">
                <div class="workspace-leaf-content" data-type="markdown" data-mode="preview">
                  <div class="view-content">
                    <div class="markdown-reading-view" style="width: 100%; height: 100%;">
                      <div
                        class="markdown-preview-view markdown-rendered node-insert-event is-readable-line-width allow-fold-headings show-indentation-guide allow-fold-lists"
                        tabindex="-1" style="tab-size: 4;">
                        <div class="markdown-preview-sizer markdown-preview-section" style="padding-bottom: 369px; min-height: 1158px;">
                          <div class="markdown-preview-pusher" style="width: 1px; height: 0.1px; margin-bottom: 0px;"></div>
                          <div class="mod-header">
                            <div class="inline-title" contenteditable="true" spellcheck="false" tabindex="-1" enterkeyhint="done">#VAR{RENDERED_CONTENT_FILE_NAME}
                            </div>
                            #VAR{RENDERED_CONTENT}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <aside class="html-outline-panel" id="htmlOutlinePanel" hidden>
    <div class="html-outline-title">
      <span>Document outline</span>
      <button class="html-outline-toggle" id="htmlOutlineToggle" type="button">Hide</button>
    </div>
    <ul class="html-outline" id="htmlOutline"></ul>
  </aside>
  <script nonce="#VAR{NONCE}" type="text/javascript">
    (function () {
      // ---- File navigation tree ----
      function joinUrl(base, path) {
        if (!base) return path;
        if (base.endsWith('/')) base = base.slice(0, -1);
        if (!path.startsWith('/')) path = '/' + path;
        return base + path;
      }

      function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (typeof text === 'string') node.textContent = text;
        return node;
      }

      function normalizePath(p) {
        return (p || '').replace(/^\/+/, '');
      }

      function currentPath() {
        return normalizePath(decodeURIComponent(window.location.pathname || ''));
      }

      function setActiveLink(container, path) {
        var items = container.querySelectorAll('[data-path]');
        items.forEach(function (n) { n.setAttribute('data-active', 'false'); });
        var active = container.querySelector('[data-path="' + path.replace(/"/g, '\\"') + '"]');
        if (active) active.setAttribute('data-active', 'true');
      }

      function renderTree(node, container, filterText) {
        if (!node || !container) return;
        var ft = (filterText || '').trim().toLowerCase();

        function matches(s) {
          return !ft || (s || '').toLowerCase().indexOf(ft) !== -1;
        }

        function renderNode(n, parentEl) {
          if (n.type === 'folder') {
            var folderRow = el('div', 'html-tree-item html-tree-folder', n.name || '/');
            folderRow.setAttribute('data-folder', n.path || '');
            folderRow.setAttribute('data-open', 'true');
            var childrenWrap = el('div', 'html-tree-children');

            var anyChild = false;
            (n.children || []).forEach(function (c) {
              var rendered = renderNode(c, childrenWrap);
              anyChild = anyChild || rendered;
            });

            // Hide empty folders after filtering.
            var folderMatches = matches(n.path || '') || matches(n.name || '');
            if (!folderMatches && !anyChild) return false;

            folderRow.addEventListener('click', function () {
              var open = folderRow.getAttribute('data-open') === 'true';
              folderRow.setAttribute('data-open', open ? 'false' : 'true');
              childrenWrap.hidden = open;
            });

            parentEl.appendChild(folderRow);
            parentEl.appendChild(childrenWrap);
            return true;
          }

          // file
          var filePath = normalizePath(n.path);
          var fileLabel = n.name || filePath;
          if (!matches(filePath) && !matches(fileLabel)) return false;

          var a = el('a', 'html-tree-item', fileLabel);
          a.href = '/' + encodeURI(filePath);
          a.setAttribute('data-path', filePath);
          a.addEventListener('click', function (e) {
            // Let normal navigation happen; prevent base-href oddities by setting absolute path.
            e.preventDefault();
            window.location.href = '/' + encodeURI(filePath);
          });
          parentEl.appendChild(a);
          return true;
        }

        container.innerHTML = '';
        renderNode(node, container);
      }

      function initNavTree() {
        var panel = document.getElementById('htmlNavPanel');
        var treeEl = document.getElementById('htmlNavTree');
        var searchEl = document.getElementById('htmlNavSearch');
        var toggleEl = document.getElementById('htmlNavToggle');
        if (!panel || !treeEl || !searchEl) return;

        document.body.classList.add('html-has-nav');

        var base = '#VAR{BACKEND_BASE_URL}' || '';
        var treeUrl = joinUrl(base, '/api/tree');

        var hiddenKey = 'html-server:nav-hidden';
        var navHidden = localStorage.getItem(hiddenKey) === 'true';
        function applyNavHidden() {
          if (navHidden) {
            panel.hidden = true;
            document.body.classList.remove('html-has-nav');
          } else {
            panel.hidden = false;
            document.body.classList.add('html-has-nav');
          }
          if (toggleEl) toggleEl.textContent = navHidden ? 'Show' : 'Hide';
        }
        if (toggleEl) {
          toggleEl.addEventListener('click', function () {
            navHidden = !navHidden;
            localStorage.setItem(hiddenKey, String(navHidden));
            applyNavHidden();
          });
        }
        applyNavHidden();

        var state = { tree: null, filter: '' };

        function rerender() {
          if (!state.tree) return;
          renderTree(state.tree, treeEl, state.filter);
          setActiveLink(treeEl, currentPath());
        }

        searchEl.addEventListener('input', function () {
          state.filter = searchEl.value || '';
          rerender();
        });

        fetch(treeUrl)
          .then(function (r) { return r.json(); })
          .then(function (json) {
            state.tree = json;
            rerender();
          })
          .catch(function (err) {
            console.error(err);
            treeEl.textContent = 'Failed to load files.';
          });
      }

      function getHeadingLevel(el) {
        var t = (el && el.tagName || '').toUpperCase();
        if (!t || t.length !== 2 || t[0] !== 'H') return 0;
        var n = parseInt(t[1], 10);
        return isNaN(n) ? 0 : n;
      }

      function buildOutline() {
        var panel = document.getElementById('htmlOutlinePanel');
        var list = document.getElementById('htmlOutline');
        if (!panel || !list) return;

        var root = document.querySelector('.markdown-preview-view');
        if (!root) return;

        var headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
        list.innerHTML = '';
        if (!headings.length) {
          panel.hidden = true;
          return;
        }

        var frag = document.createDocumentFragment();
        headings.forEach(function (h) {
          var id = h.getAttribute('id');
          if (!id) return;
          var text = (h.textContent || '').trim();
          if (!text) return;
          var level = getHeadingLevel(h);
          var li = document.createElement('li');
          li.setAttribute('data-level', String(level));
          var a = document.createElement('a');
          a.href = '#' + encodeURIComponent(id);
          a.textContent = text;
          a.addEventListener('click', function (e) {
            e.preventDefault();
            var target = document.getElementById(id);
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', '#' + encodeURIComponent(id));
          });
          li.appendChild(a);
          frag.appendChild(li);
        });
        list.appendChild(frag);
        panel.hidden = false;

        // Scrollspy
        var anchors = Array.from(list.querySelectorAll('a'));
        var byId = new Map();
        anchors.forEach(function (a) {
          var href = a.getAttribute('href') || '';
          if (!href.startsWith('#')) return;
          var id = decodeURIComponent(href.slice(1));
          byId.set(id, a);
        });

        var activeId = null;
        function setActive(id) {
          if (activeId === id) return;
          activeId = id;
          anchors.forEach(function (a) { a.setAttribute('data-active', 'false'); });
          var a = byId.get(id);
          if (a) a.setAttribute('data-active', 'true');
        }

        if ('IntersectionObserver' in window) {
          var io = new IntersectionObserver(function (entries) {
            var visible = entries
              .filter(function (e) { return e.isIntersecting; })
              .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
            if (visible.length) setActive(visible[0].target.id);
          }, { root: null, rootMargin: '-20% 0px -75% 0px', threshold: [0, 1] });

          headings.forEach(function (h) {
            if (h.getAttribute('id')) io.observe(h);
          });
        }

        // Toggle visibility (persist per browser)
        var toggle = document.getElementById('htmlOutlineToggle');
        var hiddenKey = 'html-server:outline-hidden';
        var saved = localStorage.getItem(hiddenKey);
        var isHidden = saved === 'true';
        function applyHidden() {
          if (!panel) return;
          var titleEl = panel.querySelector('.html-outline-title span');
          var btn = toggle;
          if (!btn) return;
          if (isHidden) {
            list.hidden = true;
            btn.textContent = 'Show';
          } else {
            list.hidden = false;
            btn.textContent = 'Hide';
          }
          if (titleEl) titleEl.textContent = 'Document outline';
        }
        if (toggle) {
          toggle.addEventListener('click', function () {
            isHidden = !isHidden;
            localStorage.setItem(hiddenKey, String(isHidden));
            applyHidden();
          });
        }
        applyHidden();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          initNavTree();
          buildOutline();
        });
      } else {
        initNavTree();
        buildOutline();
      }
    })();
  </script>
</body>
</html>`,
  htmlReplaceableVariables: [
    {
      varName: 'HTML_TITLE',
      varValue: 'Obsidian Html Server',
    },
    {
      varName: 'FAVICON_URL',
      varValue: '//obsidian.md/favicon.ico',
    },
    {
      varName: 'CSS_FILE_URL',
      // Relative on purpose so it works behind a proxy prefix when BASE_HREF is set.
      varValue: '.obsidian/plugins/obsidian-http-server/app.css',
    },
  ],
  showAdvancedOptions: false,
  useSimpleAuth: false,
  simpleAuthUsername: 'obsidian',
  simpleAuthPassword: randomBytes(8).toString('hex'),
};
