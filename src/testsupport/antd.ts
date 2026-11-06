import Antd from 'ant-design-vue'
import { vi } from 'vitest'

/** 受版本管理的组件测试环境；仅补齐 jsdom 缺少的浏览器观察接口。 */
export const antdPlugins = [Antd]
export function installAntdEnvironment() {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const getComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => getComputedStyle(element))
}
