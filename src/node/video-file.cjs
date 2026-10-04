'use strict';
const fs = require('fs');
function createFile(filename) {
  if (fs.existsSync(filename)) throw new Error('视频文件已存在');
  const partial = filename + '.part';
  let fd = fs.openSync(partial, 'wx'),
    completed = false;
  return {
    write(data, position) {
      const bytes = Buffer.from(data);
      let done = 0;
      while (done < bytes.length) {
        const n = fs.writeSync(fd, bytes, done, bytes.length - done, position + done);
        if (!n) throw new Error('视频写入失败');
        done += n;
      }
    },
    finish() {
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      try {
        fs.linkSync(partial, filename);
      } catch (error) {
        if (!['EPERM', 'ENOTSUP', 'EXDEV', 'ENOSYS'].includes(error.code)) throw error;
        fs.copyFileSync(partial, filename, fs.constants.COPYFILE_EXCL);
      }
      fs.unlinkSync(partial);
      completed = true;
      return { path: filename, bytes: fs.statSync(filename).size };
    },
    abort() {
      if (fd !== null) {
        fs.closeSync(fd);
        fd = null;
      }
      if (!completed && fs.existsSync(partial)) fs.unlinkSync(partial);
    }
  };
}
module.exports = { createFile };
