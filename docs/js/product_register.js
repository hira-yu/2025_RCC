const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby4pwwAzbWl5yavwF1tA5XfGgMuSNJBTKy_LILY-Z01wcnEIHQ7wYSFZy81SvpfyoEyUA/exec'; // ★ あなたのGAS WebアプリのURLに置き換えてください

// ローディングオーバーレイの表示/非表示関数
function showLoadingOverlay() {
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoadingOverlay() {
  document.getElementById('loading-overlay').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('product-register-form');
    const messageDiv = document.getElementById('message');
    const productImageInput = document.getElementById('productImage');
    const imagePreview = document.querySelector('#imagePreview img');

    // 画像プレビュー機能
    productImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.src = '';
            imagePreview.style.display = 'none';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageDiv.style.display = 'none';
        messageDiv.className = 'message';
        showLoadingOverlay(); // ローディングオーバーレイを表示

        const productName = document.getElementById('productName').value;
        const productPrice = document.getElementById('productPrice').value;
        const ingredients = document.getElementById('ingredients').value;
        const allergensRemarks = document.getElementById('allergens').value; // 備考として残す
        const imageFile = productImageInput.files[0]; // 画像ファイルを取得

        // 特定原材料の収集
        const specifiedAllergens = Array.from(document.querySelectorAll('input[name="specifiedAllergens"]:checked'))
                                        .map(checkbox => checkbox.value);

        // 特定原材料に準ずるものの収集 (複数選択プルダウンから)
        const recommendedAllergensSelect = document.getElementById('recommendedAllergensSelect');
        const recommendedAllergens = Array.from(recommendedAllergensSelect.options)
                                          .filter(option => option.selected)
                                          .map(option => option.value);

        if (!productName || !productPrice) {
            showMessage('商品名と価格は必須です。', 'error');
            return;
        }

        // オプションUIからデータを収集
        const options = [];
        const optionGroupItems = document.querySelectorAll('.option-group-item');
        for (const item of optionGroupItems) {
            const name = item.querySelector('.option-group-name').value;
            const valuesStr = item.querySelector('.option-values').value;
            const pricesStr = item.querySelector('.option-prices').value;

            if (!name || !valuesStr || !pricesStr) {
                showMessage('オプションのグループ名、値、価格はすべて入力してください。', 'error');
                return;
            }

            const values = valuesStr.split(',').map(v => v.trim());
            const prices = pricesStr.split(',').map(p => parseInt(p.trim()));

            if (values.length !== prices.length) {
                showMessage(`オプション「${name}」の値と価格の数が一致しません。`, 'error');
                return;
            }
            if (prices.some(isNaN)) {
                showMessage(`オプション「${name}」の価格に無効な値が含まれています。`, 'error');
                return;
            }

            options.push({ name, values, prices });
        }

        let imageData = null;
        if (imageFile) {
            // 画像ファイルをBase64エンコード
            imageData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(imageFile);
            });
        }

        const payload = {
            action: 'registerProduct',
            name: productName,
            price: parseInt(productPrice),
            imageData: imageData, // Base64エンコードされた画像データ
            ingredients: ingredients,
            specifiedAllergens: specifiedAllergens, // 新しい特定原材料
            recommendedAllergens: recommendedAllergens, // 新しい特定原材料に準ずるもの
            allergensRemarks: allergensRemarks, // 備考
            options: options
        };

        var postparam = {
            "method"     : "POST",
            "Content-Type" : "application/x-www-form-urlencoded",
            "body" : JSON.stringify(payload)
        };

        try {
            const response = await fetch(GAS_WEB_APP_URL, postparam);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();

            if (result.status === 'success') {
                showMessage('商品が正常に登録されました！', 'success');
                form.reset(); // フォームをリセット
                imagePreview.src = ''; // プレビューをクリア
                imagePreview.style.display = 'none';
            } else {
                showMessage(`商品登録に失敗しました: ${result.message}`, 'error');
            }
        } catch (error) {
            showMessage(`商品登録中にエラーが発生しました: ${error.message}`, 'error');
        } finally {
            hideLoadingOverlay(); // ローディングオーバーレイを非表示
        }
    });

    function showMessage(msg, type) {
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
    }

    // オプショングループ追加ボタンのイベントリスナー
    document.getElementById('addOptionGroup').addEventListener('click', addOptionGroup);

    function addOptionGroup() {
        const optionsContainer = document.getElementById('optionsContainer');
        const groupIndex = optionsContainer.children.length; // 現在のグループ数でインデックスを決定

        const optionGroupDiv = document.createElement('div');
        optionGroupDiv.className = 'option-group-item';
        optionGroupDiv.innerHTML = `
            <hr>
            <label>オプショングループ名:</label>
            <input type="text" class="option-group-name" placeholder="例: サイズ" required>
            <label>オプション値と価格調整 (カンマ区切り):</label>
            <input type="text" class="option-values" placeholder="例: S,M,L" required>
            <input type="text" class="option-prices" placeholder="例: 0,100,200" required>
            <button type="button" class="remove-option-group">このグループを削除</button>
        `;
        optionsContainer.appendChild(optionGroupDiv);

        // 削除ボタンのイベントリスナーを設定
        optionGroupDiv.querySelector('.remove-option-group').addEventListener('click', () => {
            optionGroupDiv.remove();
        });
    }
});