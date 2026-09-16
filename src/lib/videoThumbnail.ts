// Grabs a still frame from an uploaded video file itself, so an uploaded
// Cinema video gets a real cover image "original to the video" by default —
// mirroring what youtubeThumbnailUrl already gives YouTube links for free —
// instead of teachers having to separately find/upload an unrelated cover.
export function captureVideoThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    const fail = (err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error('Could not read that video file.'));
    };

    video.addEventListener('error', () => fail(new Error('Could not read that video file.')));

    video.addEventListener('loadedmetadata', () => {
      // A tiny offset past 0 — the very first frame is often solid black on
      // encoded video, so a fraction of a second in gives a real frame.
      video.currentTime = Math.min(0.5, (video.duration || 1) / 4);
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported.');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error('Could not capture a thumbnail from that video.'));
          },
          'image/jpeg',
          0.82
        );
      } catch (err) {
        fail(err);
      }
    });
  });
}

// Reads an uploaded video file's real length, so a teacher never has to
// type it in by hand — direct teacher request: show kids roughly how long
// a video is before they tap play. YouTube links have no local file to
// read, so CinemaVideosManager collects that one as a manual estimate
// instead (this function is upload-only).
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('Could not read that video file.'));
    });

    video.addEventListener('loadedmetadata', () => {
      const seconds = video.duration;
      cleanup();
      if (Number.isFinite(seconds) && seconds > 0) resolve(seconds);
      else reject(new Error('Could not read that video’s length.'));
    });
  });
}
