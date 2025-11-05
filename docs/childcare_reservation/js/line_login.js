document.getElementById('line-login-button').addEventListener('click', function(e) {
    e.preventDefault(); // デフォルトのリンク動作をキャンセル

    const redirectToPath = '/2025_RCC/room_reservation/index.html'; // このページのパス

    // スターサーバーのPHPスクリプトを呼び出してLINEログインURLを取得
    fetch(`https://hirayu6121.stars.ne.jp/php/generate_line_login_url.php?path=${encodeURIComponent(redirectToPath)}`)
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