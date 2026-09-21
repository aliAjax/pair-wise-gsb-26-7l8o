// 编译期类型垫片：react-dom/client
export function createRoot(container: Element | DocumentFragment): {
  render(node: unknown): void;
};
