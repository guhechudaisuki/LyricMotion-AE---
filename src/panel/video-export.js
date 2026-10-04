window.LMVideo = (() => {
  function check(signal) {
    if (signal && signal.aborted) throw new Error('已取消预渲染');
  }
  async function encode(
    project,
    {
      createMovie,
      onProgress = () => {},
      signal,
      audio = null,
      format = 'mov',
      background = 'transparent',
      media = null
    }
  ) {
    if (!project.cues.length) throw new Error('请先添加歌词');
    if (format === 'mp4' && background === 'transparent')
      throw new Error('MP4 不支持透明背景，请选择底色或使用 MOV');
    const duration = Math.max(...project.cues.map((cue) => cue.end), audio ? audio.duration : 0);
    const fps = Math.round(project.fps * 1000) / 1000;
    const frames = Math.ceil(duration * fps);
    const canvas = document.createElement('canvas');
    canvas.width = project.width;
    canvas.height = project.height;
    const probe = document.createElement('canvas');
    probe.width = 160;
    probe.height = 90;
    const probeContext = probe.getContext('2d');
    const backdrop = document.createElement('canvas');
    backdrop.width = canvas.width;
    backdrop.height = canvas.height;
    const mediaTime = media && media.tagName === 'VIDEO' ? media.currentTime : null;
    if (mediaTime !== null) media.pause();
    let visibleFrames = 0,
      writer;
    try {
      check(signal);
      if (document.fonts) await document.fonts.ready;
      writer = await createMovie({ width: canvas.width, height: canvas.height, fps, frames });
      for (let frame = 0; frame < frames; frame++) {
        check(signal);
        LMRender.render(canvas, project, frame / fps, { transparent: true });
        probeContext.clearRect(0, 0, probe.width, probe.height);
        probeContext.drawImage(canvas, 0, 0, probe.width, probe.height);
        const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
        for (let i = 3; i < pixels.length; i += 4)
          if (pixels[i]) {
            visibleFrames++;
            break;
          }
        if (background !== 'transparent') {
          await seekMedia(media, frame / fps, signal);
          const context = canvas.getContext('2d');
          context.save();
          context.globalCompositeOperation = 'destination-over';
          backdrop.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
          LMRender.backdrop(
            backdrop.getContext('2d'),
            canvas.width,
            canvas.height,
            background,
            media
          );
          context.drawImage(backdrop, 0, 0);
          context.restore();
        }
        if (format === 'mp4') {
          await writer.addCanvas(canvas, frame);
        } else {
          const png = await new Promise((resolve, reject) =>
            canvas.toBlob(
              (blob) => (blob ? resolve(blob) : reject(new Error('无法编码歌词画面'))),
              'image/png'
            )
          );
          check(signal);
          await writer.addFrame(new Uint8Array(await png.arrayBuffer()));
        }
        onProgress({ frame: frame + 1, frames, stage: 'video' });
        if (frame % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (!visibleFrames) throw new Error('当前歌词方案没有可见画面，已停止导出空视频');
      if (audio) {
        const channels = Math.min(2, audio.numberOfChannels),
          rate = 48000;
        const samples = Math.ceil((frames / fps) * rate);
        const context = new OfflineAudioContext(channels, samples, rate);
        const source = context.createBufferSource();
        source.buffer = audio;
        source.connect(context.destination);
        source.start(0);
        const resampled = await context.startRendering();
        const data = Array.from({ length: channels }, (_, channel) =>
          resampled.getChannelData(channel)
        );
        for (let at = 0; at < samples; at += rate) {
          check(signal);
          const count = Math.min(rate, samples - at),
            bytes = new Uint8Array(count * channels * 2),
            view = new DataView(bytes.buffer);
          for (let sample = 0; sample < count; sample++)
            for (let channel = 0; channel < channels; channel++) {
              const value = Math.max(-1, Math.min(1, data[channel][at + sample]));
              view.setInt16(
                (sample * channels + channel) * 2,
                Math.round(value * (value < 0 ? 32768 : 32767)),
                true
              );
            }
          await writer.addAudio(bytes, rate, channels);
          onProgress({ frame: Math.min(samples, at + count), frames: samples, stage: 'audio' });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      check(signal);
      return { ...(await writer.finish()), visibleFrames };
    } catch (error) {
      if (writer) await writer.abort();
      throw error;
    } finally {
      if (mediaTime !== null) media.currentTime = mediaTime;
      backdrop.width = backdrop.height = 1;
      canvas.width = canvas.height = probe.width = probe.height = 1;
    }
  }
  async function decodeAudio(file) {
    if (!file) return null;
    const bytes = LMBridge.fs.readFileSync(file);
    const context = new AudioContext();
    try {
      return await context.decodeAudioData(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      );
    } finally {
      await context.close();
    }
  }
  async function seekMedia(media, time, signal) {
    if (!media || media.tagName !== 'VIDEO') return;
    check(signal);
    const target = Math.min(time, Math.max(0, media.duration - 0.001));
    if (Math.abs(media.currentTime - target) < 0.001 && media.readyState >= 2) return;
    await new Promise((resolve, reject) => {
      const done = (error) => {
        clearTimeout(timer);
        media.removeEventListener('seeked', ready);
        media.removeEventListener('error', failed);
        if (signal) signal.removeEventListener('abort', cancelled);
        if (error) reject(error);
        else resolve();
      };
      const ready = () => done(),
        failed = () => done(new Error('参考视频读取失败')),
        cancelled = () => done(new Error('已取消预渲染'));
      const timer = setTimeout(() => done(new Error('参考视频定位超时')), 15000);
      media.addEventListener('seeked', ready);
      media.addEventListener('error', failed);
      if (signal) signal.addEventListener('abort', cancelled, { once: true });
      media.currentTime = target;
    });
  }
  return { encode, decodeAudio };
})();
