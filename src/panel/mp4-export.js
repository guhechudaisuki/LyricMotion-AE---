window.LMMP4 = (() => {
  async function configuration(spec, audioChannels) {
    if (typeof VideoEncoder === 'undefined')
      throw new Error('当前 AE 面板不支持 MP4 编码，请选择透明 MOV');
    let video = null;
    const bitrate = Math.round(Math.min(40000000, spec.width * spec.height * spec.fps * 0.24));
    for (const hardwareAcceleration of ['prefer-hardware', 'prefer-software']) {
      for (const codec of ['avc1.640034', 'avc1.4d0033', 'avc1.420033']) {
        const candidate = {
          codec,
          width: spec.width,
          height: spec.height,
          framerate: spec.fps,
          bitrate,
          hardwareAcceleration,
          avc: { format: 'avc' }
        };
        try {
          if ((await VideoEncoder.isConfigSupported(candidate)).supported) {
            video = candidate;
            break;
          }
        } catch (_) {}
      }
      if (video) break;
    }
    if (!video) throw new Error('当前面板无法以此尺寸编码 H.264，请降低尺寸或选择 MOV');
    const audio = audioChannels
      ? { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: audioChannels, bitrate: 192000 }
      : null;
    if (
      audio &&
      (typeof AudioEncoder === 'undefined' ||
        !(await AudioEncoder.isConfigSupported(audio)).supported)
    )
      throw new Error('当前面板不支持 AAC 音频编码，请取消包含音乐或选择 MOV');
    return { video, audio };
  }
  async function create(filename, spec, audioChannels, createFile = LMBridge.createVideoFile) {
    const config = await configuration(spec, audioChannels);
    const file = await createFile(filename);
    let video,
      audio,
      failure = null,
      audioSamples = 0;
    try {
      const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.StreamTarget({
          onData: (bytes, at) => file.write(bytes, at),
          chunked: true,
          chunkSize: 1048576
        }),
        // mp4-muxer uses frameRate as its integer track timescale. Keep the
        // actual fractional FPS in VideoEncoder and per-frame timestamps.
        video: {
          codec: 'avc',
          width: spec.width,
          height: spec.height,
          frameRate: Math.round(spec.fps * 1000)
        },
        ...(config.audio
          ? { audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: audioChannels } }
          : {}),
        fastStart: false,
        firstTimestampBehavior: 'offset'
      });
      video = new VideoEncoder({
        output: (chunk, metadata) => {
          try {
            muxer.addVideoChunk(chunk, metadata);
          } catch (error) {
            failure = error;
          }
        },
        error: (error) => {
          failure = error;
        }
      });
      video.configure(config.video);
      if (config.audio) {
        audio = new AudioEncoder({
          output: (chunk, metadata) => {
            try {
              muxer.addAudioChunk(chunk, metadata);
            } catch (error) {
              failure = error;
            }
          },
          error: (error) => {
            failure = error;
          }
        });
        audio.configure(config.audio);
      }
      const check = () => {
        if (failure) throw failure;
      };
      return {
        async addCanvas(canvas, index) {
          check();
          const frame = new VideoFrame(canvas, {
            timestamp: Math.round((index * 1000000) / spec.fps),
            duration:
              Math.round(((index + 1) * 1000000) / spec.fps) -
              Math.round((index * 1000000) / spec.fps),
            alpha: 'discard'
          });
          try {
            video.encode(frame, { keyFrame: index % Math.max(1, Math.round(spec.fps * 2)) === 0 });
          } finally {
            frame.close();
          }
          if (video.encodeQueueSize >= 8) await video.flush();
          check();
        },
        async addAudio(bytes, sampleRate, channels) {
          check();
          const count = bytes.length / (channels * 2);
          const data = new AudioData({
            format: 's16',
            sampleRate,
            numberOfChannels: channels,
            numberOfFrames: count,
            timestamp: Math.round((audioSamples * 1000000) / sampleRate),
            data: bytes
          });
          try {
            audio.encode(data);
          } finally {
            data.close();
          }
          audioSamples += count;
          if (audio.encodeQueueSize >= 4) await audio.flush();
          check();
        },
        async finish() {
          await video.flush();
          if (audio) await audio.flush();
          check();
          muxer.finalize();
          video.close();
          if (audio) audio.close();
          return {
            ...(await file.finish()),
            frames: spec.frames,
            duration: spec.frames / spec.fps
          };
        },
        async abort() {
          if (video.state !== 'closed') video.close();
          if (audio && audio.state !== 'closed') audio.close();
          await file.abort();
        }
      };
    } catch (error) {
      if (video && video.state !== 'closed') video.close();
      if (audio && audio.state !== 'closed') audio.close();
      await file.abort();
      throw error;
    }
  }
  return { create, configuration };
})();
