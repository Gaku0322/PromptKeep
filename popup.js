document.addEventListener('DOMContentLoaded', () => {
  // DOM要素の取得
  const elements = {
    list: document.getElementById('prompt-list'),
    search: document.getElementById('search-box'),
    addForm: document.getElementById('add-form'),
    inputTitle: document.getElementById('input-title'),
    inputTags: document.getElementById('input-tags'),
    inputContent: document.getElementById('input-content'),
    btns: {
      toggle: document.getElementById('toggle-form-btn'),
      save: document.getElementById('save-btn'),
      cancel: document.getElementById('cancel-btn'),
      export: document.getElementById('export-btn')
    }
  };

  // アプリ起動時にデータを読み込む
  loadPrompts();

  // --- イベントリスナー ---

  // 新規作成ボタン（表示切り替え）
  elements.btns.toggle.addEventListener('click', () => toggleForm(true));
  elements.btns.cancel.addEventListener('click', () => toggleForm(false));

  // 保存ボタン
  elements.btns.save.addEventListener('click', savePrompt);

  // 検索ボックス（入力するたびにフィルタリング）
  elements.search.addEventListener('input', (e) => loadPrompts(e.target.value));

  // JSON書き出しボタン
  elements.btns.export.addEventListener('click', exportData);


  // --- 関数定義 ---

  // フォームの表示・非表示
  function toggleForm(show) {
    elements.addForm.style.display = show ? 'block' : 'none';
    elements.btns.toggle.style.display = show ? 'none' : 'block';
    if(show) elements.inputTitle.focus();
  }

  // プロンプトの保存処理
  function savePrompt() {
    const title = elements.inputTitle.value.trim();
    const content = elements.inputContent.value.trim();
    const tagsStr = elements.inputTags.value.trim();

    if (!title || !content) {
      showToast("タイトルと本文は必須です！");
      return;
    }

    const tags = tagsStr ? tagsStr.split(/,|、/).map(t => t.trim()).filter(t => t) : [];

    const newPrompt = {
      id: Date.now(),
      title,
      content,
      tags,
      createdAt: new Date().toISOString()
    };

    chrome.storage.local.get(['prompts'], (result) => {
      const prompts = result.prompts || [];
      prompts.unshift(newPrompt); // 新しいものを一番上に
      chrome.storage.local.set({ prompts }, () => {
        // フォームをリセットして閉じる
        elements.inputTitle.value = '';
        elements.inputContent.value = '';
        elements.inputTags.value = '';
        toggleForm(false);
        loadPrompts(); // リスト再描画
        showToast("保存しました！");
      });
    });
  }

  // データ読み込み＆描画
  function loadPrompts(filterText = '') {
    chrome.storage.local.get(['prompts'], (result) => {
      elements.list.innerHTML = '';
      const prompts = result.prompts || [];
      const filter = filterText.toLowerCase();

      // フィルタリング（タイトル、本文、タグで検索）
      const filtered = prompts.filter(p => {
        return p.title.toLowerCase().includes(filter) ||
               p.content.toLowerCase().includes(filter) ||
               p.tags.some(t => t.toLowerCase().includes(filter));
      });

      if (filtered.length === 0) {
        elements.list.innerHTML = `<div style="text-align:center; color:#888; margin-top:20px;">
          ${prompts.length === 0 ? 'まだプロンプトがありません。<br>「＋ 新規」から追加しよう！' : '見つかりませんでした。'}
        </div>`;
        return;
      }

      // カードの生成
      filtered.forEach(p => {
        const item = document.createElement('div');
        item.className = 'item';
        
        const tagsHtml = p.tags.map(t => `<span class="tag">${t}</span>`).join('');

        item.innerHTML = `
          <div class="item-header">
            <span class="item-title">${escapeHtml(p.title)}</span>
          </div>
          <div class="item-tags">${tagsHtml}</div>
          <div class="item-preview">${escapeHtml(p.content)}</div>
          <div class="item-actions">
            <button class="copy-btn">コピー</button>
            <button class="delete-btn">削除</button>
          </div>
        `;

        // コピーボタンの動作
        item.querySelector('.copy-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(p.content).then(() => {
            showToast("コピーしました！");
          });
        });

        // 削除ボタンの動作
        item.querySelector('.delete-btn').addEventListener('click', () => {
          if (confirm(`「${p.title}」を削除してもいいですか？`)) {
            deletePrompt(p.id);
          }
        });

        elements.list.appendChild(item);
      });
    });
  }

  // 削除処理
  function deletePrompt(id) {
    chrome.storage.local.get(['prompts'], (result) => {
      const prompts = result.prompts || [];
      const newPrompts = prompts.filter(p => p.id !== id);
      chrome.storage.local.set({ prompts: newPrompts }, () => {
        loadPrompts(elements.search.value); // 今の検索状態を維持したまま再描画
      });
    });
  }

  // JSON書き出し（バックアップ）
  function exportData() {
    chrome.storage.local.get(['prompts'], (result) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result.prompts, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `prompt-backup-${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  // トースト表示
  function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.innerText = msg;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
  }

  // HTMLエスケープ（XSS対策）
  function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
});