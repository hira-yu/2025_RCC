document.addEventListener('DOMContentLoaded', () => {
    const productsList = document.getElementById('products-list');
    const addProductBtn = document.getElementById('add-product-btn');
    addProductBtn.addEventListener('click', () => {
        openProductModal();
    });
    const productModal = document.getElementById('product-modal');
    const closeModalBtn = productModal.querySelector('.close-button');
    const productForm = document.getElementById('product-form');
    const productIdInput = document.getElementById('product-id');
    const productNameInput = document.getElementById('product-name');
    const productPriceInput = document.getElementById('product-price');
    const productImageInput = document.getElementById('product-image'); // input type="file"
    const imagePreview = document.querySelector('#image-preview img'); // 画像プレビュー
    const productIngredientsInput = document.getElementById('product-ingredients');
    const productAllergensRemarksInput = document.getElementById('product-allergens-remarks');
    // 特定原材料チェックボックスグループ
    const specifiedAllergensCheckboxes = document.querySelectorAll('input[name="specifiedAllergens"]');
    // 推奨原材料複数選択プルダウン
    const productRecommendedAllergensSelect = document.getElementById('product-recommended-allergens-select');
    // オプション設定UI
    const optionsContainer = document.getElementById('options-container');
    const addOptionGroupBtn = document.getElementById('add-option-group-btn');

    const deleteProductBtn = document.getElementById('delete-product-btn');
    const logoutBtn = document.getElementById('header-logout-btn'); // IDを修正

    const API_ENDPOINT = new URL('../../php/admin_products.php', window.location.href).toString(); // APIエンドポイント
    const AUTH_ENDPOINT = new URL('../../php/auth.php', window.location.href).toString(); // 認証エンドポイントを追加

    let currentProducts = []; // 現在表示中の商品データ

    // 商品データを読み込む
    async function loadProducts() {
        try {
            // ADMIN_PRODUCTS_API_URLは既にadmin_products.phpへの絶対パス
            // URLSearchParamsを使用してクエリパラメータを追加
            const url = new URL(API_ENDPOINT);
            url.searchParams.append('action', 'getProducts');

            const response = await fetch(url.toString());
            const result = await response.json();

            console.log("API Response for getProducts:", result); // ★ 追加

            if (result.status === 'success') {
                currentProducts = result.products;
                displayProducts(currentProducts);
            } else {
                alert('商品データの読み込みに失敗しました: ' + result.message);
            }
        } catch (error) {
            console.error('Error loading products:', error);
            alert('商品データの読み込み中にエラーが発生しました。');
        }
    }

    // 商品一覧を表示する
    function displayProducts(products) {
        productsList.innerHTML = '';
        if (products.length === 0) {
            productsList.innerHTML = '<p>商品が登録されていません。</p>';
            return;
        }

        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <h3>${product.name}</h3>
                <p>価格: ¥${product.price.toLocaleString()}</p>
                <p>ID: ${product.id}</p>
                <button class="edit-button" data-id="${product.id}">編集</button>
            `;
            productsList.appendChild(productCard);
        });

        // 編集ボタンにイベントリスナーを設定
        productsList.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                const productToEdit = currentProducts.find(p => p.id === productId);
                openProductModal(productToEdit);
            });
        });
    }

    // 商品モーダルを開く
    function openProductModal(product = null) {
        productForm.reset();
        deleteProductBtn.style.display = 'none';
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        optionsContainer.innerHTML = ''; // オプションUIをクリア

        // 特定原材料チェックボックスをすべて解除
        specifiedAllergensCheckboxes.forEach(checkbox => checkbox.checked = false);
        // 推奨原材料の選択をすべて解除
        if (productRecommendedAllergensSelect.multiSelectDropdownInstance) {
            productRecommendedAllergensSelect.multiSelectDropdownInstance.reset();
        } else {
            Array.from(productRecommendedAllergensSelect.options).forEach(option => {
                option.selected = false;
            });
            productRecommendedAllergensSelect.dispatchEvent(new Event('change'));
        }


        if (product) {
            // 編集モード
            document.querySelector('#product-modal h3').textContent = '商品の編集';
            productIdInput.value = product.id;
            productNameInput.value = product.name;
            productPriceInput.value = product.price;
            // 画像URLがあればプレビュー表示
            if (product.image_url) {
                imagePreview.src = product.image_url;
                imagePreview.style.display = 'block';
            }
            productIngredientsInput.value = product.ingredients || '';
            productAllergensRemarksInput.value = product.allergens_remarks || '';

            // 特定原材料のチェックボックスをセット
            if (product.specified_allergens && Array.isArray(product.specified_allergens)) {
                product.specified_allergens.forEach(allergen => {
                    const checkbox = document.querySelector(`input[name="specifiedAllergens"][value="${allergen}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }

            // 推奨原材料の複数選択プルダウンをセット
            if (product.recommended_allergens && Array.isArray(product.recommended_allergens)) {
                Array.from(productRecommendedAllergensSelect.options).forEach(option => {
                    option.selected = product.recommended_allergens.includes(option.value);
                });
                // multi-select-dropdownが適用されている場合は更新をトリガー
                if (productRecommendedAllergensSelect.multiSelectDropdownInstance) {
                    productRecommendedAllergensSelect.multiSelectDropdownInstance.update();
                } else {
                    productRecommendedAllergensSelect.dispatchEvent(new Event('change'));
                }
            }

            // オプションUIを生成
            if (product.options && Array.isArray(product.options)) {
                product.options.forEach(optionGroup => {
                    addOptionGroup(optionGroup); // 既存データでオプショングループを追加
                });
            }

            deleteProductBtn.style.display = 'inline-block';
        } else {
            // 追加モード
            document.querySelector('#product-modal h3').textContent = '商品の追加';
            productIdInput.value = ''; // 新規追加時はIDは自動生成
        }
        productModal.style.display = 'flex';
    }

    // モーダルを閉じる
    closeModalBtn.addEventListener('click', () => {
        productModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === productModal) {
            productModal.style.display = 'none';
        }
    });

    // 商品の追加/編集を処理する
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const productId = productIdInput.value;
        const action = productId ? 'updateProduct' : 'addProduct';

        // 画像ファイルの処理
        let imageData = null;
        if (productImageInput.files && productImageInput.files[0]) {
            imageData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(productImageInput.files[0]);
            });
        }

        // 特定原材料の収集
        const specifiedAllergens = Array.from(specifiedAllergensCheckboxes)
                                        .filter(checkbox => checkbox.checked)
                                        .map(checkbox => checkbox.value);

        // 推奨原材料の収集
        const recommendedAllergens = Array.from(productRecommendedAllergensSelect.options)
                                          .filter(option => option.selected)
                                          .map(option => option.value);

        // オプションUIからデータを収集
        const options = [];
        const optionGroupItems = document.querySelectorAll('.option-group-item');
        for (const item of optionGroupItems) {
            const name = item.querySelector('.option-group-name').value;
            const valuesStr = item.querySelector('.option-values').value;
            const pricesStr = item.querySelector('.option-prices').value;

            if (!name || !valuesStr || !pricesStr) {
                alert('オプションのグループ名、値、価格はすべて入力してください。');
                // hideLoadingOverlay(); // ローディングオーバーレイを非表示 (このファイルにはない)
                return;
            }

            const values = valuesStr.split(',').map(v => v.trim());
            const prices = pricesStr.split(',').map(p => parseInt(p.trim()));

            if (values.length !== prices.length) {
                alert(`オプション「${name}」の値と価格の数が一致しません。`);
                // hideLoadingOverlay(); // ローディングオーバーレイを非表示 (このファイルにはない)
                return;
            }
            if (prices.some(isNaN)) {
                alert(`オプション「${name}」の価格に無効な値が含まれています。`);
                // hideLoadingOverlay(); // ローディングオーバーレイを非表示 (このファイルにはない)
                return;
            }

            options.push({ name, values, prices });
        }

        const productData = {
            id: productId,
            name: productNameInput.value,
            price: parseInt(productPriceInput.value),
            image_data: imageData, // Base64エンコードされた画像データ
            ingredients: productIngredientsInput.value,
            allergens_remarks: productAllergensRemarksInput.value,
            specified_allergens: specifiedAllergens,
            recommended_allergens: recommendedAllergens,
            options: options,
        };

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, product: productData })
            });
            const result = await response.json();

            if (result.status === 'success') {
                alert(result.message);
                closeProductModal();
                loadProducts(); // 商品一覧を再読み込み
            } else {
                alert('操作に失敗しました: ' + result.message);
            }
        } catch (error) {
            console.error('Error saving product:', error);
            alert('商品の保存中にエラーが発生しました。');
        }
    });

    // 商品の削除を処理する
    deleteProductBtn.addEventListener('click', async () => {
        const productId = productIdInput.value;
        if (!confirm(`商品ID: ${productId} を削除してもよろしいですか？`)) {
            return;
        }

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'deleteProduct', id: productId })
            });
            const result = await response.json();

            if (result.status === 'success') {
                alert(result.message);
                closeProductModal();
                loadProducts(); // 商品一覧を再読み込み
            } else {
                alert('削除に失敗しました: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('商品の削除中にエラーが発生しました。');
        }
    });

    // オプショングループ追加ボタンのイベントリスナー
    addOptionGroupBtn.addEventListener('click', () => {
        console.log('Add Option Group button clicked!'); // デバッグ用
        addOptionGroup();
    });

    function addOptionGroup(optionGroup = null) {
        const groupIndex = optionsContainer.children.length; // 現在のグループ数でインデックスを決定

        const optionGroupDiv = document.createElement('div');
        optionGroupDiv.className = 'option-group-item';
        optionGroupDiv.innerHTML = `
            <hr>
            <label>オプショングループ名:</label>
            <input type="text" class="option-group-name" placeholder="例: サイズ" required>
            <label>オプション値 (カンマ区切り):</label>
            <input type="text" class="option-values" placeholder="例: S,M,L" required>
            <label>価格調整 (カンマ区切り):</label>
            <input type="text" class="option-prices" placeholder="例: 0,100,200" required>
            <button type="button" class="remove-option-group">このグループを削除</button>
        `;
        optionsContainer.appendChild(optionGroupDiv);

        // 既存のデータがあればセット
        if (optionGroup) {
            optionGroupDiv.querySelector('.option-group-name').value = optionGroup.name || '';
            optionGroupDiv.querySelector('.option-values').value = (optionGroup.values && Array.isArray(optionGroup.values)) ? optionGroup.values.join(',') : '';
            optionGroupDiv.querySelector('.option-prices').value = (optionGroup.prices && Array.isArray(optionGroup.prices)) ? optionGroup.prices.join(',') : '';
        }

        // 削除ボタンのイベントリスナーを設定
        optionGroupDiv.querySelector('.remove-option-group').addEventListener('click', () => {
            optionGroupDiv.remove();
        });
    }

    // 認証チェック
    async function checkAuth() {
        try {
            const response = await fetch(`${AUTH_ENDPOINT}?action=check_auth`);
            const data = await response.json();
            if (!data.logged_in) {
                window.location.href = 'login.html'; // 未認証ならログインページへ
            } else {
                // 認証済みであれば、管理メニューページへリダイレクト
                // ただし、このページ自体が管理機能なので、ここではリダイレクトしない
                // ログインページからのリダイレクト先がdashboard.htmlになるため、
                // ここでは何もしないか、必要に応じてdashboard.htmlにリダイレクトする
                // 今回は、このページが直接開かれた場合に認証済みならそのまま表示する
                // もし、常にdashboard.htmlを経由させたい場合は以下を有効にする
                // window.location.href = 'dashboard.html';
            }
        } catch (error) {
            console.error('認証チェック中にエラーが発生しました:', error);
            window.location.href = 'login.html'; // エラー時もログインページへ
        }
    }
    checkAuth(); // ページロード時に認証チェックを実行

    // ログアウト処理
    logoutBtn.addEventListener('click', async (event) => { // event引数を追加
        event.preventDefault(); // デフォルトのリンク動作をキャンセル
        if (confirm('ログアウトしますか？')) {
            try {
                const response = await fetch(`${AUTH_ENDPOINT}?action=logout`);
                const data = await response.json();
                if (data.status === 'success') {
                    window.location.href = 'login.html'; // ログアウト成功後、ログインページへ
                } else {
                    alert('ログアウトに失敗しました: ' + data.message);
                }
            } catch (error) {
                console.error('ログアウト中にエラーが発生しました:', error);
                alert('ログアウト中にエラーが発生しました。');
            }
        }
    });

    // 初期ロード
    loadProducts();
});
