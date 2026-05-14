document.addEventListener('DOMContentLoaded', function () {
  var sqlBox = document.getElementById('sqlBox');
  var copyBtn = document.getElementById('copyBtn');
  var downloadBtn = document.getElementById('downloadBtn');

  function showError(msg) {
    if (sqlBox) sqlBox.value = '-- Error loading SQL: ' + msg;
  }

  // Try fetching the SQL file relative to the site root.
  fetch('../../database/queries/ai_chat_setup_and_validation.sql')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (text) {
      if (sqlBox) sqlBox.value = text;
    })
    .catch(function () {
      // Try a fallback relative path (some servers serve from project root)
      fetch('../database/queries/ai_chat_setup_and_validation.sql')
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (text) {
          if (sqlBox) sqlBox.value = text;
        })
        .catch(function (err) {
          showError(err && err.message ? err.message : 'network');
        });
    });

  copyBtn.addEventListener('click', function () {
    if (!sqlBox) return;
    var text = sqlBox.value || '';
    navigator.clipboard
      .writeText(text)
      .then(function () {
        copyBtn.textContent = 'Copied';
        setTimeout(function () {
          copyBtn.textContent = 'Copy SQL';
        }, 1500);
      })
      .catch(function () {
        copyBtn.textContent = 'Copy failed';
      });
  });

  downloadBtn.addEventListener('click', function () {
    if (!sqlBox) return;
    var blob = new Blob([sqlBox.value || ''], { type: 'text/sql;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'ai_chat_setup_and_validation.sql';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
});
