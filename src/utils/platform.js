import { Capacitor } from '@capacitor/core';

/**
 * 현재 앱이 모바일 기기의 네이티브 플랫폼(Android 또는 iOS)에서 실행 중인지 여부를 반환합니다.
 * PWA나 웹 브라우저 환경인 경우 false를 반환합니다.
 * @returns {boolean} 네이티브 플랫폼 환경 여부
 */
export function isNativeApp() {
  return Capacitor.isNativePlatform();
}
