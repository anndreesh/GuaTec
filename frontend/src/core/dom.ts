/** Tiny helper for building DOM trees without a full templating library. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    html?: string;
    attrs?: Record<string, string>;
    children?: (HTMLElement | string)[];
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.html !== undefined) node.innerHTML = options.html;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  }
  if (options.children) {
    for (const child of options.children) {
      node.append(child instanceof HTMLElement ? child : document.createTextNode(child));
    }
  }
  return node;
}

export function loadingFeedback(label: string): HTMLElement {
  return el("div", {
    className: "loading-feedback",
    attrs: { role: "status", "aria-live": "polite" },
    children: [
      el("span", { className: "loading-spinner", attrs: { "aria-hidden": "true" } }),
      el("span", { text: label }),
    ],
  });
}
