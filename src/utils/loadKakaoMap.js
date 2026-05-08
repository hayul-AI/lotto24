let kakaoMapPromise = null;

export function loadKakaoMap() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저 환경이 아닙니다."));
  }

  const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

  if (!KAKAO_KEY) {
    return Promise.reject(
      new Error("VITE_KAKAO_MAP_KEY가 없습니다. .env 파일을 확인하세요.")
    );
  }

  // 1. 이미 완전히 로드되어 사용 가능한 경우
  if (window.kakao && window.kakao.maps && window.kakao.maps.load && window.kakao.maps.services) {
    return new Promise((resolve) => {
      window.kakao.maps.load(() => resolve(window.kakao));
    });
  }

  // 2. 로딩 중인 Promise가 있는 경우
  if (kakaoMapPromise) {
    return kakaoMapPromise;
  }

  // 3. 새로 로드 시작
  kakaoMapPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-kakao-map="true"]');

    const handleScriptLoad = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          if (window.kakao.maps.services) {
            resolve(window.kakao);
          } else {
            kakaoMapPromise = null;
            reject(new Error("Kakao Maps SDK 로드 성공했으나 services 라이브러리가 없습니다."));
          }
        });
      } else {
        kakaoMapPromise = null;
        reject(new Error("Kakao SDK script는 로드됐지만 window.kakao 객체가 없습니다."));
      }
    };

    const handleScriptError = (err) => {
      kakaoMapPromise = null;
      const errorMsg = "Kakao Maps SDK 스크립트 로드 실패. 도메인 등록(http://localhost)을 확인하세요.";
      console.error(errorMsg, err);
      reject(new Error(errorMsg));
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleScriptLoad);
      existingScript.addEventListener("error", handleScriptError);
      // 만약 이미 로드된 상태라면 즉시 실행
      if (window.kakao && window.kakao.maps) handleScriptLoad();
      return;
    }

    const script = document.createElement("script");
    script.setAttribute("data-kakao-map", "true");
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services`;

    script.onload = handleScriptLoad;
    script.onerror = handleScriptError;

    document.head.appendChild(script);
  });

  return kakaoMapPromise;
}
