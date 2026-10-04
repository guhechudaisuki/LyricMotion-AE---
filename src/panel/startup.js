/* Keep panel initialization failures visible even when app.js cannot finish binding. */
(function () {
  function show(message) {
    var connection = document.getElementById('connection'),
      status = document.getElementById('status');
    if (connection) {
      connection.textContent = '面板加载异常';
      connection.classList.add('connection-error');
    }
    if (status)
      status.textContent =
        '面板错误：' + message + '。请关闭面板再打开；仍有问题时可提供这段错误。';
  }
  window.addEventListener('error', function (event) {
    if (event.message) show(event.message);
  });
  window.addEventListener('unhandledrejection', function (event) {
    show(event.reason && event.reason.message ? event.reason.message : String(event.reason));
  });
})();
