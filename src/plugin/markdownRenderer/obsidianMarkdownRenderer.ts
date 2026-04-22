import {
  App,
  MarkdownPreviewRenderer,
  MarkdownView,
  WorkspaceLeaf,
} from 'typings';
import HtmlServerPlugin from 'plugin/main';
import { CustomMarkdownRenderer } from './customMarkdownRenderer';
import { MarkdownPreviewView } from 'obsidian';
import { joinBaseUrl, normalizeBaseUrl } from 'plugin/server/urlUtils';

export class ObsidianMarkdownRenderer extends CustomMarkdownRenderer {
  rootElement: HTMLDivElement;

  constructor(private plugin: HtmlServerPlugin, private app: App) {
    super();
    this.patchObisianMarkdownRenderer();
    this.rootElement = this.getOrCreateRootDomElement();
  }

  private slugifyHeading(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[\s]+/g, '-')
      .replace(/[^\p{L}\p{N}\-_.]/gu, '');
  }

  private patchObisianMarkdownRenderer() {
    const originalQueueRenderFn = MarkdownPreviewRenderer.prototype.queueRender;

    const alteredQueueRenderFn: typeof originalQueueRenderFn = function (
      this: MarkdownPreviewRenderer
    ) {
      this.rendered || (this.rendered = []);
      const e = this.queued;
      const t = !this.parsing;
      if (e && t && !e.high) {
        e.cancel();
        const timeOut = setTimeout(this.onRender.bind(this), 0);
        this.queued = {
          high: true,
          cancel: () => clearTimeout(timeOut),
        };
      } else {
        const n = t ? 0 : 200;
        const timeOut = setTimeout(this.onRender.bind(this), n);
        this.queued = {
          high: !n,
          cancel: () => clearTimeout(timeOut),
        };
      }
    };

    // console.log(
    //   'Patching queueRender Function to be able to render even when the main Obsidian window is minimized/not focused'
    // );
    MarkdownPreviewRenderer.prototype.queueRender = alteredQueueRenderFn;

    this.plugin.register(() => {
      MarkdownPreviewRenderer.prototype.queueRender = originalQueueRenderFn;
    });
  }

  private getOrCreateRootDomElement() {
    const maybe = document.querySelector<HTMLDivElement>(
      'body .html-server-rendering-element'
    );
    if (!maybe) {
      const rootEl = document.body.createEl('div');
      rootEl.addClass('html-server-rendering-element');
      return rootEl;
    }
    return maybe;
  }

  async renderHtmlFromMarkdown(markdown: string): Promise<string> {
    // Create New Leaf
    //@ts-ignore
    const leaf = new WorkspaceLeaf(this.app);

    const el = this.rootElement.createDiv();
    leaf.containerEl = el;

    const view = new MarkdownView(leaf);
    leaf.view = view;

    // @ts-ignore
    view.currentMode = new MarkdownPreviewView(leaf.view);
    view.currentMode.type = 'preview';
    let n = 0;

    const renderedPromise = new Promise<string>((resolve, _reject) => {
      view.currentMode.onRenderComplete = () => {
        if (view.currentMode.renderer.queued) {
          return;
        }
        if (!n++) {
          const callouts =
            view.currentMode.renderer.previewEl.querySelectorAll(
              '.callout-icon svg'
            );
          callouts.forEach((el) => {
            el.parentElement?.removeChild(el);
          });
          //@ts-ignore
          view.currentMode.renderer.sections.forEach((section) => {
            const promisses: Promise<void>[] = [];
            //@ts-ignore
            view.currentMode.renderer.owner.postProcess(
              section,
              promisses,
              //@ts-ignore
              view.currentMode.renderer.frontmatter
            );
            if (promisses.length) {
              //@ts-ignore
              view.currentMode.renderer.asyncSections.push(section);
              Promise.all(promisses).then(function () {
                //@ts-ignore
                view.currentMode.renderer.asyncSections.remove(section),
                  section.resetCompute(),
                  view.currentMode.renderer.queueRender();
              });
            }
          });
          view.currentMode.renderer.onRender(); // Force a rerender to update everithing that needs css (callout-icons, etc?)
          return;
        }

        this.postProcess(view.currentMode.renderer.previewEl);

        const html = view.currentMode.renderer.previewEl.innerHTML;
        // view.currentMode.renderer.previewEl.detach();

        // view.currentMode.onRenderComplete = () => {};

        leaf.detach();
        this.rootElement.removeChild(el);
        resolve(html);
      };
    });

    view.currentMode.renderer.set(markdown);

    return renderedPromise;
  }

  private postProcess(el: Element) {
    const frontendBase = normalizeBaseUrl(this.plugin.settings.frontendBaseUrl) || normalizeBaseUrl(this.plugin.settings.backendBaseUrl);

    // Ensure headings have stable ids so the frontend can build an outline and deep links work.
    const headingIdCounts = new Map<string, number>();
    const headings = el.querySelectorAll<HTMLHeadingElement>(
      'h1, h2, h3, h4, h5, h6'
    );
    headings.forEach((h) => {
      const existing = h.getAttribute('id');
      if (existing) {
        headingIdCounts.set(existing, (headingIdCounts.get(existing) ?? 0) + 1);
        return;
      }

      const base =
        this.slugifyHeading(h.textContent || '') ||
        `heading-${h.tagName.toLowerCase()}`;
      const count = headingIdCounts.get(base) ?? 0;
      const id = count === 0 ? base : `${base}-${count + 1}`;
      headingIdCounts.set(base, count + 1);
      h.setAttribute('id', id);
    });

    const links = el.querySelectorAll<HTMLAnchorElement>('a.internal-link');

    links.forEach((link) => {
      link.target = '';

      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;

      // Normalize Obsidian's internal links to be root-relative so they do not depend on <base href>
      // and do not break when clicking from nested paths.
      const normalizedHref =
        href.startsWith('/') || /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(href)
          ? href
          : '/' + href.replace(/^\.\/+/, '');

      if (!frontendBase) {
        if (normalizedHref !== href) link.setAttribute('href', normalizedHref);
        return;
      }

      // When served behind a proxy prefix, convert to prefixed absolute path/URL.
      link.setAttribute('href', joinBaseUrl(frontendBase, normalizedHref));
    });

    const embeds = el.querySelectorAll<HTMLSpanElement>(
      'span.internal-embed.markdown-embed.inline-embed'
    );

    embeds.forEach((embed) => {
      if (embed.parentElement && embed.parentElement.parentElement) {
        embed.parentElement.parentElement.style.position = 'relative';
      }
      //TODO: change link to anchor
    });

    const imagesContainers = el.querySelectorAll<HTMLDivElement>(
      '.internal-embed.media-embed.image-embed'
    );

    imagesContainers.forEach((imageContainer) => {
      const src = imageContainer.getAttribute('src') || '';
      const imageElement = imageContainer.querySelector('img');
      if (imageElement) {
        const normalizedSrc =
          src.startsWith('/') || /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(src)
            ? src
            : '/' + src.replace(/^\.\/+/, '');

        imageElement.src = frontendBase
          ? joinBaseUrl(frontendBase, normalizedSrc)
          : normalizedSrc;
      }
    });

    // const callouts = el.querySelectorAll('.callout');
    // callouts.forEach((callout) => {
    // });
  }
}
