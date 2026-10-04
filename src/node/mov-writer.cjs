'use strict';
// QuickTime PNG samples preserve Canvas RGBA without an external encoder.
const fs = require('fs');
const u16 = (n) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
};
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const u64 = (n) => Buffer.concat([u32(Math.floor(n / 4294967296)), u32(n % 4294967296)]);
const zero = (n) => Buffer.alloc(n);
const box = (name, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([u32(body.length + 8), Buffer.from(name, 'ascii'), body]);
};
const full = (name, flags, ...parts) => box(name, u32(flags), ...parts);
const matrix = Buffer.concat([u32(65536), zero(12), u32(65536), zero(12), u32(1073741824)]);
const table = (name, rows) =>
  full(name, 0, u32(rows.length), ...rows.map((row) => Buffer.concat(row.map(u32))));

function createMovie(filename, spec) {
  const { width, height, fps, frames } = spec;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    !Number.isFinite(fps) ||
    fps < 1 ||
    fps > 120 ||
    !Number.isInteger(frames) ||
    frames < 1 ||
    frames > 4294967
  )
    throw new Error('无效的视频尺寸、帧率或帧数');
  if (fs.existsSync(filename)) throw new Error('视频文件已存在，已停止以免覆盖');
  const partial = filename + '.part';
  let fd = fs.openSync(partial, 'wx'),
    position = 0,
    completed = false;
  const sizes = [],
    offsets = [],
    audioSizes = [],
    audioOffsets = [];
  let audioSamples = 0,
    audioRate = 0,
    audioChannels = 0;
  const timescale = Math.round(fps * 1000),
    duration = frames * 1000;
  function write(bytes, at = position) {
    let done = 0;
    while (done < bytes.length) {
      const count = fs.writeSync(fd, bytes, done, bytes.length - done, at + done);
      if (!count) throw new Error('写入视频失败，请检查磁盘空间');
      done += count;
    }
    position = Math.max(position, at + bytes.length);
  }
  function track(id, kind, sampleSizes, sampleOffsets, count, rate, delta, description, channels) {
    const video = kind === 'vide';
    const mediaHeader = video ? full('vmhd', 1, zero(8)) : full('smhd', 0, zero(4));
    const sampleTable = box(
      'stbl',
      full('stsd', 0, u32(1), description),
      table('stts', [[count, delta]]),
      table('stsc', [[1, 1, 1]]),
      full('stsz', 0, u32(0), u32(sampleSizes.length), Buffer.concat(sampleSizes.map(u32))),
      full('co64', 0, u32(sampleOffsets.length), Buffer.concat(sampleOffsets.map(u64)))
    );
    // PCM chunks hold many samples; one byte-size table entry per PCM frame.
    const audioTable = video
      ? null
      : box(
          'stbl',
          full('stsd', 0, u32(1), description),
          table('stts', [[count, 1]]),
          table(
            'stsc',
            sampleSizes.map((size, index) => [index + 1, size / (channels * 2), 1])
          ),
          full('stsz', 0, u32(channels * 2), u32(count)),
          full('co64', 0, u32(sampleOffsets.length), Buffer.concat(sampleOffsets.map(u64)))
        );
    return box(
      'trak',
      full(
        'tkhd',
        3,
        zero(8),
        u32(id),
        u32(0),
        u32(duration),
        zero(8),
        zero(4),
        u16(video ? 0 : 256),
        zero(2),
        matrix,
        u32(video ? width * 65536 : 0),
        u32(video ? height * 65536 : 0)
      ),
      box(
        'mdia',
        full('mdhd', 0, zero(8), u32(rate), u32(count * delta), zero(4)),
        full(
          'hdlr',
          0,
          zero(4),
          Buffer.from(kind),
          zero(12),
          Buffer.from(video ? 'LyricMotion video\0' : 'LyricMotion audio\0')
        ),
        box(
          'minf',
          mediaHeader,
          box('dinf', full('dref', 0, u32(1), full('url ', 1))),
          video ? sampleTable : audioTable
        )
      )
    );
  }
  try {
    write(box('ftyp', Buffer.from('qt  '), u32(0), Buffer.from('qt  ')));
    const mdatStart = position;
    write(Buffer.concat([u32(1), Buffer.from('mdat'), u64(0)]));
    return {
      addFrame(bytes) {
        const png = Buffer.from(bytes);
        if (
          sizes.length >= frames ||
          png.length < 33 ||
          png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
          png.readUInt32BE(16) !== width ||
          png.readUInt32BE(20) !== height
        )
          throw new Error('视频帧无效或尺寸不一致');
        offsets.push(position);
        sizes.push(png.length);
        write(png);
      },
      addAudio(bytes, sampleRate, channels) {
        if (
          ![1, 2].includes(channels) ||
          sampleRate !== 48000 ||
          (audioRate && (audioRate !== sampleRate || audioChannels !== channels))
        )
          throw new Error('无效的音频格式');
        const pcm = Buffer.from(bytes);
        if (!pcm.length || pcm.length % (channels * 2)) throw new Error('音频数据不完整');
        audioRate = sampleRate;
        audioChannels = channels;
        audioSamples += pcm.length / (channels * 2);
        audioOffsets.push(position);
        audioSizes.push(pcm.length);
        write(pcm);
      },
      finish() {
        if (sizes.length !== frames) throw new Error('视频帧未写完，已停止导入');
        write(u64(position - mdatStart), mdatStart + 8);
        const compressor = Buffer.alloc(32);
        compressor[0] = 3;
        compressor.write('PNG', 1, 'ascii');
        const description = box(
          'png ',
          zero(6),
          u16(1),
          zero(16),
          u16(width),
          u16(height),
          u32(72 * 65536),
          u32(72 * 65536),
          zero(4),
          u16(1),
          compressor,
          u16(32),
          u16(65535)
        );
        const tracks = [track(1, 'vide', sizes, offsets, frames, timescale, 1000, description)];
        if (audioSamples)
          tracks.push(
            track(
              2,
              'soun',
              audioSizes,
              audioOffsets,
              audioSamples,
              audioRate,
              1,
              box(
                'sowt',
                zero(6),
                u16(1),
                zero(8),
                u16(audioChannels),
                u16(16),
                zero(4),
                u32(audioRate * 65536)
              ),
              audioChannels
            )
          );
        write(
          box(
            'moov',
            full(
              'mvhd',
              0,
              zero(8),
              u32(timescale),
              u32(duration),
              u32(65536),
              u16(256),
              zero(10),
              matrix,
              zero(24),
              u32(tracks.length + 1)
            ),
            ...tracks
          )
        );
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = null;
        // link is exclusive: a newly appeared destination is never overwritten.
        try {
          fs.linkSync(partial, filename);
        } catch (error) {
          if (!['EPERM', 'ENOTSUP', 'EXDEV', 'ENOSYS'].includes(error.code)) throw error;
          fs.copyFileSync(partial, filename, fs.constants.COPYFILE_EXCL);
        }
        fs.unlinkSync(partial);
        completed = true;
        return {
          path: filename,
          frames,
          duration: duration / timescale,
          bytes: fs.statSync(filename).size
        };
      },
      abort() {
        if (fd !== null) {
          fs.closeSync(fd);
          fd = null;
        }
        if (!completed && fs.existsSync(partial)) fs.unlinkSync(partial);
      }
    };
  } catch (error) {
    if (fd !== null) fs.closeSync(fd);
    if (fs.existsSync(partial)) fs.unlinkSync(partial);
    throw error;
  }
}
module.exports = { createMovie };
