//! AlaveX native capture/encode/media server.
//!
//! Independent of Sunshine/Moonlight:
//! Windows: DXGI → `h264_nvenc` or `libx264`.
//! macOS: ScreenCaptureKit → `h264_videotoolbox` or `libx264`.
//! Annex-B NAL units go out over custom UDP :47998 (LLU2).

#[cfg(any(windows, target_os = "macos"))]
mod audio;
#[cfg(any(windows, target_os = "macos"))]
mod capture;
#[cfg(any(windows, target_os = "macos"))]
mod encode;
#[cfg(any(windows, target_os = "macos"))]
mod server;

#[cfg(any(windows, target_os = "macos"))]
pub use encode::EncoderBackend;
#[cfg(any(windows, target_os = "macos"))]
pub use server::{MediaHub, MediaStats, MEDIA_PORT};

#[cfg(not(any(windows, target_os = "macos")))]
pub const MEDIA_PORT: u16 = 47998;

#[cfg(not(any(windows, target_os = "macos")))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EncoderBackend {
    Nvenc,
    Videotoolbox,
    Software,
}

#[cfg(not(any(windows, target_os = "macos")))]
impl EncoderBackend {
    pub fn wire_name(self) -> &'static str {
        match self {
            Self::Nvenc => "nvenc",
            Self::Videotoolbox => "videotoolbox",
            Self::Software => "software",
        }
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
pub struct MediaHub;

#[cfg(not(any(windows, target_os = "macos")))]
impl MediaHub {
    pub fn new(_pin: String) -> Self {
        Self
    }
    pub fn set_pin(&self, _pin: String) {}
    pub fn issue_token(&self, _ttl: std::time::Duration) -> String {
        "00000000000000000000000000000000".into()
    }
    pub fn preferred_backend(&self) -> EncoderBackend {
        EncoderBackend::Software
    }
    pub fn start_stream(&self, _w: u32, _h: u32, _fps: u32, _bitrate: u32, _audio: bool) {}
    pub fn stop_stream(&self) {}
    pub fn snapshot_stats(&self) -> MediaStats {
        MediaStats {
            streaming: false,
            viewers: 0,
            frames_sent: 0,
            audio_sent: 0,
            backend: "software".into(),
            host_audio: false,
        }
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaStats {
    pub streaming: bool,
    pub viewers: usize,
    pub frames_sent: u64,
    pub audio_sent: u64,
    pub backend: String,
    pub host_audio: bool,
}

pub fn spawn(hub: std::sync::Arc<MediaHub>) {
    #[cfg(any(windows, target_os = "macos"))]
    {
        std::thread::Builder::new()
            .name("alavex-media".into())
            .spawn(move || {
                if let Err(err) = server::run_blocking(hub) {
                    eprintln!("AlaveX media server stopped: {err}");
                }
            })
            .expect("failed to spawn media thread");
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = hub;
    }
}
