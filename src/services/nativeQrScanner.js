import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

/**
 * 네이티브 환경용 QR 코드 스캐너를 실행합니다.
 * @returns {Promise<{success: boolean, decodedText?: string, error?: string}>}
 */
export async function scanNativeQrCode() {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, error: '네이티브 환경이 아닙니다.' };
  }

  try {
    // 1. 권한 요청 (ML Kit 바코드 스캐너의 경우)
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== 'granted' && camera !== 'limited') {
      return { success: false, error: '카메라 권한이 필요합니다.' };
    }

    // 2. 바코드 스캔 화면 실행
    // 스캔이 완료되면 모달이 닫히고 결과가 반환됨
    const { barcodes } = await BarcodeScanner.scan();

    if (barcodes && barcodes.length > 0) {
      // 3. QR 코드가 있으면 첫 번째 결과의 텍스트 반환
      return { 
        success: true, 
        decodedText: barcodes[0].rawValue || barcodes[0].displayValue 
      };
    } else {
      return { success: false, error: 'QR 코드를 찾을 수 없거나 취소되었습니다.' };
    }
  } catch (error) {
    console.error('Native QR Scanner error:', error);
    return { success: false, error: '스캔 중 오류가 발생했습니다: ' + error.message };
  }
}
