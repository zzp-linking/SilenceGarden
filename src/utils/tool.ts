export interface OperatingSystem {
  isTablet: boolean
  isPhone: boolean
  isAndroid: boolean
  isPc: boolean
}

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
