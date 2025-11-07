document.getElementById('line-login-button').addEventListener('click', function(e) {
    e.preventDefault(); // デフォルトのリンク動作をキャンセル

    const redirectToPath = '/2025_RCC/room_reservation/index.html'; // このページのパス

    // スターサーバーのPHPスクリプトを呼び出してLINEログインURLを取得
    fetch(`https://momoport.hirayu.jp/php/generate_line_login_url.php?path=${encodeURIComponent(redirectToPath)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.lineLoginUrl) {
                window.location.href = data.lineLoginUrl; // 取得したURLにリダイレクト
            } else {
                console.error('LINE Login URL not received:', data);
                alert('LINEログインURLの取得に失敗しました。');
            }
        })
        .catch(error => {
            console.error('Error fetching LINE Login URL:', error);
            alert('LINEログイン中にエラーが発生しました。');
        });
});

// LINEログイン状態をチェックし、ボタンの表示を切り替える
function checkLineLoginStatus() {
    const lineUserId = sessionStorage.getItem('lineUserId');
    const lineLoginButton = document.getElementById('line-login-button');
    if (lineUserId && lineLoginButton) {
        lineLoginButton.style.display = 'none'; // LINEログイン済みであればボタンを非表示にする
    } else if (lineLoginButton) {
        lineLoginButton.style.display = ''; // 未ログインであればボタンを表示する
    }
}

// ページ読み込み時と、必要に応じて他のイベントでチェック
document.addEventListener('DOMContentLoaded', checkLineLoginStatus);
window.addEventListener('storage', checkLineLoginStatus); // sessionStorageが変更されたときにチェック