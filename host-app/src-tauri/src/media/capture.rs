//! Desktop capture.
//!
//! Windows: DXGI desktop duplication via `scrap` (tightly packed BGRA).
//! macOS: ScreenCaptureKit via `xcap`, converted from RGBA to BGRA.

#[cfg(windows)]
mod platform {
    use scrap::{Capturer, Display};
    use std::io::ErrorKind;

    pub struct DesktopCapture {
        capturer: Capturer,
        pub width: usize,
        pub height: usize,
    }

    impl DesktopCapture {
        pub fn primary() -> Result<Self, String> {
            let display =
                Display::primary().map_err(|e| format!("디스플레이를 열 수 없습니다: {e}"))?;
            let width = display.width();
            let height = display.height();
            let capturer = Capturer::new(display)
                .map_err(|e| format!("화면 캡처를 시작할 수 없습니다: {e}"))?;
            Ok(Self {
                capturer,
                width,
                height,
            })
        }

        pub fn next_frame_bgra(&mut self) -> Result<Vec<u8>, String> {
            loop {
                match self.capturer.frame() {
                    Ok(frame) => {
                        let stride = frame.len() / self.height;
                        let row_bytes = self.width * 4;
                        if stride < row_bytes {
                            return Err(format!("예상치 못한 stride={stride}"));
                        }
                        if stride == row_bytes {
                            return Ok(frame.to_vec());
                        }
                        let mut packed = vec![0u8; self.width * self.height * 4];
                        for y in 0..self.height {
                            let src = y * stride;
                            let dst = y * row_bytes;
                            packed[dst..dst + row_bytes]
                                .copy_from_slice(&frame[src..src + row_bytes]);
                        }
                        return Ok(packed);
                    }
                    Err(err) if err.kind() == ErrorKind::WouldBlock => {
                        std::thread::yield_now();
                    }
                    Err(err) => return Err(format!("화면 캡처 실패: {err}")),
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use xcap::Monitor;

    pub struct DesktopCapture {
        monitor: Monitor,
        pub width: usize,
        pub height: usize,
    }

    impl DesktopCapture {
        pub fn primary() -> Result<Self, String> {
            let monitors = Monitor::all().map_err(|e| {
                format!(
                    "디스플레이를 열 수 없습니다: {e}. 시스템 설정 > 개인정보 보호 및 보안 > 화면 기록에서 AlaveX Host를 허용해주세요."
                )
            })?;
            let monitor = monitors
                .into_iter()
                .find(|m| m.is_primary().unwrap_or(false))
                .ok_or_else(|| {
                    "주 디스플레이를 찾지 못했습니다. 화면 기록 권한을 확인해주세요.".to_string()
                })?;
            let width = monitor
                .width()
                .map_err(|e| format!("디스플레이 너비를 읽지 못했습니다: {e}"))?
                as usize;
            let height = monitor
                .height()
                .map_err(|e| format!("디스플레이 높이를 읽지 못했습니다: {e}"))?
                as usize;
            if width == 0 || height == 0 {
                return Err("디스플레이 크기가 0입니다.".into());
            }
            Ok(Self {
                monitor,
                width,
                height,
            })
        }

        pub fn next_frame_bgra(&mut self) -> Result<Vec<u8>, String> {
            let image = self.monitor.capture_image().map_err(|e| {
                format!(
                    "화면 캡처 실패: {e}. 시스템 설정 > 개인정보 보호 및 보안 > 화면 기록에서 AlaveX Host를 허용한 뒤 앱을 다시 실행해주세요."
                )
            })?;
            let w = image.width() as usize;
            let h = image.height() as usize;
            if w == 0 || h == 0 {
                return Err("빈 프레임입니다.".into());
            }
            self.width = w;
            self.height = h;
            let mut bgra = image.into_raw();
            for px in bgra.chunks_exact_mut(4) {
                px.swap(0, 2);
            }
            Ok(bgra)
        }
    }
}

#[cfg(any(windows, target_os = "macos"))]
pub use platform::DesktopCapture;
