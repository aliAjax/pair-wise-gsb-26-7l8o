// 编译期类型垫片（通过 tsconfig paths 生效；Vite 运行时仍打包真实 React）。
// 自有组件的 props 仍由其函数签名严格检查。
export type ReactNode = any;
export type ComponentType<P = any> = (props: P) => any;

export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
export function useMemo<T>(factory: () => T, deps: ReadonlyArray<unknown>): T;
export function useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<unknown>): void;
export function useSyncExternalStore<T>(
  subscribe: (onChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T
): T;

export const StrictMode: any;
export const Fragment: any;
const React: any;
export default React;

export const jsx: any;
export const jsxs: any;

type AnyHandler = (event: any) => void;
interface AnyIntrinsicProps {
  children?: any;
  className?: string;
  onChange?: AnyHandler;
  onClick?: AnyHandler;
  onInput?: AnyHandler;
  onSubmit?: AnyHandler;
  [prop: string]: any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [element: string]: AnyIntrinsicProps;
    }
    interface IntrinsicAttributes {
      key?: any;
    }
    interface Element {}
    interface ElementClass {}
    interface ElementAttributesProperty {
      props: any;
    }
    interface ElementChildrenAttribute {
      children: any;
    }
  }
}
