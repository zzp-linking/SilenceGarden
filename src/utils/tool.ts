export interface OperatingSystem {
  /** 是否按平板布局处理。 */
  isTablet: boolean
  /** 是否按手机布局处理。 */
  isPhone: boolean
  /** User-Agent 是否表示 Android。 */
  isAndroid: boolean
  /** 是否按桌面布局处理。 */
  isPc: boolean
}

/** 根据 User-Agent 粗略判断布局所需的设备类别；不用于安全或能力检测。 */
export const os = (): OperatingSystem => {
  const ua = navigator.userAgent
  const isWindowsPhone = /(?:Windows Phone)/.test(ua)
  const isSymbian = /(?:SymbianOS)/.test(ua) || isWindowsPhone
  const isAndroid = /(?:Android)/.test(ua)
  const isFireFox = /(?:Firefox)/.test(ua)
  const isTablet = /(?:iPad|PlayBook)/.test(ua)
    || (isAndroid && !/(?:Mobile)/.test(ua))
    || (isFireFox && /(?:Tablet)/.test(ua))
  const isPhone = /(?:iPhone)/.test(ua) && !isTablet

  return {
    isTablet,
    isPhone,
    isAndroid,
    isPc: !isPhone && !isAndroid && !isSymbian
  }
}

export const isPc = (): boolean => os().isPc
