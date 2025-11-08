// const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby4pwwAzbWl5yavwF1tA5XfGgMuSNJBTKy_LILY-Z01wcnEIHQ7wYSFZy81SvpfyoEyUA/exec';
const PHP_ORDER_API_URL = 'https://momoport.hirayu.jp/php/submit_order.php'; // 新しいPHPエンドポイント
const PHP_PRODUCTS_API_URL = 'https://momoport.hirayu.jp/php/get_products.php'; // 新しい商品取得PHPエンドポイント
const PHP_ORDER_HISTORY_API_URL = 'https://momoport.hirayu.jp/php/get_order_history.php'; // 新しい注文履歴取得PHPエンドポイント
const noImg_url = 'https://lh3.googleusercontent.com/d/1XwsZXQfdlJSt_ztCATEuRcDzWkbz_lk5';

// 既存の定数
const productListEl = document.getElementById('product-list');
const cartItemsEl = document.getElementById('cart-items');
const totalPriceEl = document.getElementById('total-price');
const messageEl = document.getElementById('message');
const cart = {}; // { product_id: { item_object, quantity } }
let productsData = []; // ★商品データを全体で保持するための新しい変数
let currentProduct = null; // ★現在モーダルに表示中の商品

// 注文確認モーダル関連の要素
const orderConfirmModal = document.getElementById('order-confirm-modal');
const cartItemsDetailEl = document.getElementById('cart-items-detail');
const totalPriceDetailEl = document.getElementById('total-price-detail');

// ミニカートバー関連の要素
const itemCountEl = document.getElementById('item-count');
const totalPriceMiniEl = document.getElementById('total-price-mini');

const MAX_ITEM_QUANTITY = 10; // 商品あたりの最大注文個数

function showLoadingOverlay() {
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoadingOverlay() {
  document.getElementById('loading-overlay').style.display = 'none';
}

function openResultModal(title, message) {
  document.getElementById('result-modal-title').textContent = title;
  document.getElementById('result-modal-message').textContent = message;
  document.getElementById('result-modal').style.display = 'inline-flex';
}

function closeResultModal() {
  document.getElementById('result-modal').style.display = 'none';
}


// -------------------------------------------
// 商品データの取得と表示
// -------------------------------------------
async function loadProducts() {
  messageEl.textContent = '';
  try {
    // URLをPHPエンドポイントに変更
    const response = await fetch(PHP_PRODUCTS_API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json(); // result.products を取得
    if (result.status === 'success') {
        displayProducts(result.products);
    } else {
        handleError(result.message || '商品データの取得に失敗しました。');
    }
  } catch (error) {
    handleError('商品データの取得に失敗しました: ' + error.message);
  }
}

function displayProducts(products) {
  document.getElementById('loading').style.display = 'none';

  if (products.error) {
    handleError(products.error || '商品データが見つかりませんでした。');
    return;
  }
  
  if (products.length === 0) {
    productListEl.innerHTML = '<div id="loading" style="text-align: center; font-size: 32px;">現在、注文できる商品はありません。</div>';
    return;
  }
  
  // ★ 取得した商品データを全体で保持する
  productsData = products;

  productListEl.innerHTML = '';
  
  products.forEach(product => {
    // ★ カートの初期化はaddToCartFromModalで行うため、ここからは削除
    // cart[product.id] = { 
    //   id: product.id,
    //   name: product.name,
    //   price: product.price,
    //   quantity: 0
    // };

    const card = document.createElement('div');
    card.className = 'product-card';
    
    // ★ クリックイベントを追加し、openModalを呼び出す
    card.onclick = () => openModal(product.id);
    
    const imageHtml = product.imageUrl ? `
      <div class="product-image-container">
        <img src="${product.imageUrl}" alt="${product.name}" class="product-image">
      </div>
    ` : `<div class="product-image-container no-image">
        <img src="${noImg_url}" alt="画像なし" class="product-image">
      </div>`;

    const detailsHtml = `
      <div>
        <h3 class="product-name">${product.name}</h3>
        <p class="product-price">¥${product.price.toLocaleString()}</p>
        <div class="product-info details">
          <strong>原材料:</strong> ${product.ingredients || '未記載'}<br>
          <strong>アレルギー:</strong> ${product.allergens || '未記載'}
        </div>
      </div>
    `;

    // ★ 数量入力とカートボタンを削除
    card.innerHTML = imageHtml + detailsHtml;

    productListEl.appendChild(card);
  });
}

// -------------------------------------------
// モーダルウィンドウの制御 (新規作成)
// -------------------------------------------
function openModal(productId) {
  const product = productsData.find(p => p.id === productId);
  if (!product) return;

  currentProduct = product;
  document.getElementById('modal-product-name').textContent = product.name;
  document.getElementById('modal-product-price').textContent = `価格: ¥${product.price.toLocaleString()}`;
  document.getElementById('modal-ingredients').innerHTML = `<strong>原材料:</strong> ${product.ingredients || '未記載'}`;
  document.getElementById('modal-allergens').innerHTML = `<strong>アレルギー:</strong> ${product.allergens || '未記載'}`;
  
  const modalImage = document.getElementById('modal-image');
  modalImage.src = product.imageUrl || noImg_url;
  modalImage.alt = product.name;

  // カートの現在の数量を反映させる
  const currentQty = cart[productId] ? cart[productId].quantity : 0;
  document.getElementById('modal-quantity').value = currentQty > 0 ? currentQty : 1;

  // オプション選択UIを生成
  const optionsContainer = document.getElementById('modal-options-container');
  optionsContainer.innerHTML = ''; // 既存のオプションをクリア

  if (product.options && product.options.length > 0) {
    product.options.forEach((optionGroup, index) => {
      const optionGroupDiv = document.createElement('div');
      optionGroupDiv.className = 'option-group';
      optionGroupDiv.innerHTML = `<label>${optionGroup.name}:</label>`;

      const selectEl = document.createElement('select');
      selectEl.id = `option-select-${index}`;
      selectEl.className = 'option-select';
      selectEl.onchange = updateModalPrice; // オプション選択時に価格を更新

      // 最初の選択肢として「オプションなし」を追加
      const noOptionEl = document.createElement('option');
      noOptionEl.value = `なし|0`; // 価格調整は0
      noOptionEl.textContent = `なし`;
      selectEl.appendChild(noOptionEl);

      optionGroup.values.forEach((value, valIndex) => {
        const optionEl = document.createElement('option');
        optionEl.value = `${value}|${optionGroup.prices[valIndex]}`; // 値と価格調整を結合
        optionEl.textContent = `${value} (+${optionGroup.prices[valIndex]}円)`;
        selectEl.appendChild(optionEl);
      });
      optionGroupDiv.appendChild(selectEl);
      optionsContainer.appendChild(optionGroupDiv);
    });
  }

  document.getElementById('product-modal').style.display = 'inline-flex';
  updateModalPrice(); // 初期表示時の価格を更新
}

// -------------------------------------------
// 数量増減ボタンの処理
// -------------------------------------------
function changeQuantity(delta) {
  const qtyInput = document.getElementById('modal-quantity');
  let currentValue = parseInt(qtyInput.value) || 1;
  let newValue = currentValue + delta;
  
  const minVal = parseInt(qtyInput.min) || 1;

  // 最小値チェック (1未満にはしない)
  if (newValue < minVal) {
      newValue = minVal;
  }
  // 最大値チェック (MAX_ITEM_QUANTITYを超えないようにする)
  if (newValue > MAX_ITEM_QUANTITY) {
      newValue = MAX_ITEM_QUANTITY;
  }
  
  qtyInput.value = newValue;
}

function updateModalPrice() {
  if (!currentProduct) return;

  let basePrice = currentProduct.price;
  let optionPriceAdjustment = 0;
  const optionsContainer = document.getElementById('modal-options-container');
  const selectElements = optionsContainer.querySelectorAll('.option-select');

  selectElements.forEach(selectEl => {
    const selectedOptionValue = selectEl.value;
    if (selectedOptionValue) {
      const pricePart = selectedOptionValue.split('|')[1];
      optionPriceAdjustment += parseInt(pricePart);
    }
  });

  const displayPrice = basePrice + optionPriceAdjustment;
  document.getElementById('modal-product-price').textContent = `価格: ¥${displayPrice.toLocaleString()}`;
}

function closeModal() {
  document.getElementById('product-modal').style.display = 'none';
  currentProduct = null;
  document.getElementById('modal-message').textContent = '';
  renderCart(); // カートの数量を更新したかもしれないので再描画
}

// -------------------------------------------
// モーダルからのカート追加 (新規作成)
// -------------------------------------------
function addToCartFromModal() {
  if (!currentProduct) return;
  
  const qtyInput = document.getElementById('modal-quantity');
  const quantity = parseInt(qtyInput.value) || 0;

  if (quantity <= 0) {
    openResultModal('エラー', '数量は1以上で入力してください。');
    return;
  }

  showLoadingOverlay(); // ローディングオーバーレイを表示

  try {
    // 選択されたオプション情報を取得
    const selectedOptions = [];
    let optionPriceAdjustment = 0;
    const optionsContainer = document.getElementById('modal-options-container');
    const selectElements = optionsContainer.querySelectorAll('.option-select');

    selectElements.forEach(selectEl => {
      const selectedOptionValue = selectEl.value;
      const [value, pricePart] = selectedOptionValue.split('|');
      const priceAdjustment = parseInt(pricePart);

      // 「なし」オプションが選択された場合はselectedOptionsに追加しない
      if (value !== 'なし') {
        const groupName = selectEl.previousElementSibling.textContent.replace(':', ''); // ラベルからグループ名を取得
        selectedOptions.push({
          groupName: groupName,
          optionValue: value,
          priceAdjustment: priceAdjustment
        });
      }
      optionPriceAdjustment += priceAdjustment; // 「なし」の場合も価格調整は0として加算
    });

    // カート内のアイテムを一意に識別するために、商品IDと選択されたオプションの組み合わせを使用
    const cartItemId = currentProduct.id + JSON.stringify(selectedOptions);

    const existingQuantity = cart[cartItemId] ? cart[cartItemId].quantity : 0;
    const newTotalQuantity = existingQuantity + quantity;

    if (newTotalQuantity > MAX_ITEM_QUANTITY) {
      hideLoadingOverlay(); // エラーの場合はローディングオーバーレイを非表示
      openResultModal('エラー', `1つの商品の注文は${MAX_ITEM_QUANTITY}個までです。`);
      return;
    }

    if (!cart[cartItemId]) {
      cart[cartItemId] = {
        id: currentProduct.id,
        name: currentProduct.name,
        price: currentProduct.price,
        imageUrl: currentProduct.imageUrl,
        ingredients: currentProduct.ingredients,
        allergens: currentProduct.allergens,
        selectedOptions: selectedOptions,
        optionPriceAdjustment: optionPriceAdjustment,
        quantity: 0
      };
    }
    cart[cartItemId].quantity += quantity; // 合計数量を加算
    
    const successMessage = `✅ ${currentProduct.name}を${quantity}個カートに追加しました。`;
    hideLoadingOverlay(); // ローディングオーバーレイを非表示
    closeModal(); // 商品モーダルを閉じる
    openResultModal('カートに追加', successMessage);
  } catch (error) {
    const errorMessage = `❌ カートへの追加に失敗しました: ${error.message}`;
    hideLoadingOverlay(); // ローディングオーバーレイを非表示
    closeModal(); // 商品モーダルを閉じる
    openResultModal('エラー', errorMessage);
  }
}

// -------------------------------------------
// カートの更新 (変更なし)
// -------------------------------------------
function updateCart(id, name, price, qtyStr) {
  const quantity = parseInt(qtyStr) || 0;
  
  if (cart[id]) {
    cart[id].quantity = quantity;
  }
  
  renderCart();
}

// -------------------------------------------
// カートの更新 (renderCart関数を修正)
// -------------------------------------------
function renderCart() {
    console.log('Cart content before rendering:', cart); // デバッグ用ログを追加
    let detailHtml = '';
    let total = 0;
    let totalItemsCount = 0; // 商品の種類の数

    for (const id in cart) {
      const item = cart[id];
      if (item.quantity > 0) {
        const itemBasePrice = item.price;
        const itemOptionPriceAdjustment = item.optionPriceAdjustment || 0;
        const itemPriceWithOption = itemBasePrice + itemOptionPriceAdjustment;
        const itemTotal = itemPriceWithOption * item.quantity;
        total += itemTotal;
        totalItemsCount += item.quantity; // 全商品の合計数量をカウント

        let optionsDisplay = '';
        if (Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0) {
          optionsDisplay = item.selectedOptions.map(opt => `${opt.groupName}: ${opt.optionValue}`).join(', ');
          optionsDisplay = `<p class="cart-item-options">(${optionsDisplay})</p>`;
        }

        detailHtml += `
          <div class="cart-item">
              <span class="item-name">${item.name}</span>
              ${optionsDisplay}
              <span class="item-price">¥${itemTotal.toLocaleString()}</span>
              <div class="item-controls">
                  <div class="quantity-control">
                      <button class="qty-button" onclick="updateCartItemQuantity('${id}', -1)">&minus;</button>
                      <input type="number" class="item-quantity" value="${item.quantity}" min="1" max="${MAX_ITEM_QUANTITY}" onchange="updateCartItemQuantity('${id}', 0, this.value)">
                      <button class="qty-button" onclick="updateCartItemQuantity('${id}', 1)">&plus;</button>
                  </div>
                  <button class="remove-item-button" onclick="removeCartItem('${id}')"><i class="fas fa-trash-alt"></i></button>
              </div>
          </div>
        `;
      }
    }

    if (totalItemsCount === 0) {
      detailHtml = '<p class="empty-cart-message">カートは空です。</p>';
    }
    
    // 1. 詳細モーダル内の要素を更新
    cartItemsDetailEl.innerHTML = detailHtml;
    totalPriceDetailEl.textContent = total.toLocaleString();

    // 2. 画面下部のミニカートバーを更新
    itemCountEl.textContent = `商品 ${totalItemsCount} 点`;
    totalPriceMiniEl.textContent = `¥ ${total.toLocaleString()}`;
}


// -------------------------------------------
// 注文確認モーダル制御 (新規作成)
// -------------------------------------------
// -------------------------------------------
// カートアイテムの数量更新
// -------------------------------------------
function updateCartItemQuantity(productId, delta, newValue = null) {
  if (!cart[productId]) return;

  let newQuantity;
  if (newValue !== null) {
    newQuantity = parseInt(newValue) || 0;
  }
  else {
    newQuantity = cart[productId].quantity + delta;
  }

  // 数量のバリデーション
  if (newQuantity < 1) newQuantity = 1; // 最小値を1に変更
  if (newQuantity > MAX_ITEM_QUANTITY) newQuantity = MAX_ITEM_QUANTITY;

  cart[productId].quantity = newQuantity;
  renderCart();
}

// -------------------------------------------
// カートアイテムの削除
// -------------------------------------------
function removeCartItem(productId) {
  if (!cart[productId]) return;

  cart[productId].quantity = 0; // 数量を0にすることで削除とみなす
  renderCart();
}


function openOrderModal() {
    // 注文モーダルを開く前に、必ずカートを再描画して最新の状態を反映させる
    renderCart(); 
    orderConfirmModal.style.display = 'inline-flex';
}

function closeOrderModal() {
    orderConfirmModal.style.display = 'none';
}

// -------------------------------------------
// 注文データの送信
// -------------------------------------------
async function submitOrder() {
  document.getElementById('submit-order').disabled = true;
  
  const customerName = document.getElementById('customerName').value.trim();
  const notes = document.getElementById('notes').value;
  
  if (!customerName) {
    // messageEl.textContent = 'エラー: お名前を入力してください。'; // 削除
    document.getElementById('submit-order').disabled = false;
    // closeOrderModal(); // カートモーダルを閉じる - 削除
    openResultModal('エラー', 'エラー: お名前を入力してください。');
    return;
  }
  
  const itemsToOrder = Object.values(cart).filter(item => item.quantity > 0).map(item => ({
    id: item.id,
    name: item.name,
    price: item.price, // 基本価格
    quantity: item.quantity,
    selectedOptions: item.selectedOptions || [] // 選択されたオプション情報
  }));
  
  if (itemsToOrder.length === 0) {
    // messageEl.textContent = 'エラー: 注文する商品がありません。'; // 削除
    document.getElementById('submit-order').disabled = false;
    // closeOrderModal(); // カートモーダルを閉じる - 削除
    openResultModal('エラー', 'エラー: 注文する商品がありません。');
    return;
  }
  showLoadingOverlay(); // ローディングオーバーレイを表示

  const lineUserId = getLineUserId(); // LINEユーザーIDを取得
  const customerEmail = document.getElementById('customerEmail').value.trim(); // 追加
  const customerPhone = document.getElementById('customerPhone').value.trim(); // 追加
  const payload = {
    action: 'submitOrder',
    lineUserId: lineUserId, // LINEユーザーIDを追加
    customerName: "​" + customerName,
    customerEmail: customerEmail, // 追加
    customerPhone: customerPhone, // 追加
    notes: "​" + notes,
    items: itemsToOrder
  };

  var postparam = {
    "method"     : "POST",
    "headers"    : {
      "Content-Type" : "application/json" // Content-Typeをjsonに変更
    },
    "body" : JSON.stringify(payload)
  };

  try {
    const response = await fetch(PHP_ORDER_API_URL, postparam); // URLをPHPエンドポイントに変更
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    handleOrderSuccess(result);
  } catch (error) {
    handleError('注文の送信に失敗しました: ' + error.message);
  }

}

async function handleOrderSuccess(response) {
  hideLoadingOverlay(); // ローディングオーバーレイを非表示
  document.getElementById('submit-order').disabled = false;
  
  if (response && response.status === 'success') {
    closeOrderModal(); // カートモーダルを閉じる
    let successMessage = '✅ 注文は正常に送信されました！';
    if (response.orderId) {
      successMessage += `\nご注文ID: ${response.orderId}`; // 注文IDを表示
      sessionStorage.setItem('lastOrderId', response.orderId); // セッションストレージに保存
    }
    openResultModal('注文完了', successMessage);
    // フォームとカートをリセット
    document.getElementById('customerName').value = '';
    document.getElementById('notes').value = '';
    for (const id in cart) {
      cart[id].quantity = 0;
      const qtyInput = document.getElementById(`qty-${id}`);
      if (qtyInput) qtyInput.value = 0;
    }
    renderCart();
  } else {
    // 成功しなかった場合はエラーとして処理
    handleError(response.message || '注文は失敗しました。');
  }
}

// -------------------------------------------
// エラーハンドリング関数 
// -------------------------------------------
function handleError(error) {
  hideLoadingOverlay(); // ローディングオーバーレイを非表示
  // 注文送信中の場合はボタンを再度有効にする
  const submitButton = document.getElementById('submit-order');
  if (submitButton) {
    submitButton.disabled = false;
  }

  console.error("致命的なエラーが発生しました:", error);
  const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
  // messageEl.textContent = errorMessage; // 削除
  
  // closeOrderModal(); // カートモーダルを閉じる - 削除
  openResultModal('エラー', errorMessage); // 結果モーダルでエラーを表示
  
  // モーダルが開いている場合は閉じる（モーダル内エラーの場合を想定）
  document.getElementById('modal-message').textContent = '';
}

// -------------------------------------------
// その他のイベントリスナー
// -------------------------------------------
// モーダル外クリックで閉じる処理
window.onclick = function(event) {
  const productModal = document.getElementById('product-modal');
  const orderConfirmModal = document.getElementById('order-confirm-modal'); // 追加
  const resultModal = document.getElementById('result-modal'); // 追加
  const orderStatusModal = document.getElementById('order-status-modal'); // 追加

  if (event.target == productModal) {
    closeModal();
  }
  if (event.target == orderConfirmModal) { // 追加
    closeOrderModal();
  }
  if (event.target == resultModal) { // 追加
    closeResultModal();
  }
  if (event.target == orderStatusModal) { // 追加
    closeOrderStatusModal();
  }
}

// URLパラメータからLINEユーザーIDを取得し、sessionStorageに保存
const urlParams = new URLSearchParams(window.location.search);
const lineUserIdFromUrl = urlParams.get('lineUserId');
if (lineUserIdFromUrl) {
    sessionStorage.setItem('lineUserId', lineUserIdFromUrl);
    // URLからlineUserIdパラメータを削除してリロード（URLをクリーンにするため）
    const newUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
}

// sessionStorageからLINEユーザーIDを取得するヘルパー関数
function getLineUserId() {
    return sessionStorage.getItem('lineUserId');
}

// URLパラメータからLINEユーザー名を取得し、入力欄に設定
const lineNameFromUrl = urlParams.get('lineName');
if (lineNameFromUrl) {
    const customerNameInput = document.getElementById('customerName');
    if (customerNameInput && !customerNameInput.value) { // 既に値がなければ自動入力
        customerNameInput.value = decodeURIComponent(lineNameFromUrl);
    }
    // URLからlineNameパラメータを削除（URLをクリーンにするため）
    const newUrl = window.location.origin + window.location.pathname + window.location.search.replace(/&?lineName=[^&]*/, '');
    window.history.replaceState({}, document.title, newUrl);
}

window.onload = loadProducts;

// 注文履歴モーダル関連の要素
const orderHistoryModal = document.getElementById('order-history-modal');
const orderHistoryList = document.getElementById('order-history-list');
const orderHistoryIcon = document.getElementById('order-history-icon');

// ------------------------------------------- 
// 注文履歴モーダル制御
// ------------------------------------------- 
function openOrderHistoryModal() {
    const lineUserId = getLineUserId();
    if (!lineUserId) {
        openResultModal('エラー', 'LINEログインが必要です。\nLINEでログインしてから注文履歴を確認してください。');
        return;
    }
    orderHistoryModal.style.display = 'inline-flex';
    loadUserOrders(lineUserId);
}

function closeOrderHistoryModal() {
    orderHistoryModal.style.display = 'none';
}

async function loadUserOrders(lineUserId) {
    orderHistoryList.innerHTML = '<p>注文履歴を読み込み中...</p>';
    try {
        // URLをPHPエンドポイントに変更
        const response = await fetch(`${PHP_ORDER_HISTORY_API_URL}?lineUserId=${lineUserId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.status === 'success') {
            displayOrderHistory(result.orders);
        } else {
            orderHistoryList.innerHTML = `<p class="error">${result.error || '注文履歴の取得に失敗しました。'}</p>`;
        }
    } catch (error) {
        orderHistoryList.innerHTML = `<p class="error">注文履歴の取得中にエラーが発生しました: ${error.message}</p>`;
        console.error("注文履歴取得エラー:", error);
    }
}

function displayOrderHistory(orders) {
    if (!orders || orders.length === 0) {
        orderHistoryList.innerHTML = '<p class="empty-history-message">注文履歴がありません。</p>';
        return;
    }

    let historyHtml = '';
    orders.forEach(order => {
        let itemsHtml = '';
        let orderTotal = 0;
        order.items.forEach(item => {
            let itemPriceWithOption = item.price;
            let optionsDisplay = '';
            if (Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0) {
                optionsDisplay = item.selectedOptions.map(opt => `${opt.groupName}: ${opt.optionValue}`).join(', ');
                optionsDisplay = ` (${optionsDisplay})`;
            }
            orderTotal += (itemPriceWithOption + item.optionPriceAdjustment) * item.quantity;
            itemsHtml += `
                <li>${item.name}${optionsDisplay} x ${item.quantity}個 - ¥${((itemPriceWithOption + item.optionPriceAdjustment) * item.quantity).toLocaleString()}</li>
            `;
        });

        historyHtml += `
            <div class="order-history-item">
                <h3>注文ID: ${order.orderId}</h3>
                <p>注文日時: ${order.orderDateTime}</p>
                <p>ステータス: ${order.status}</p>
                <p>合計金額: ¥${orderTotal.toLocaleString()}</p>
                <h4>注文商品:</h4>
                <ul>
                    ${itemsHtml}
                </ul>
            </div>
        `;
    });
    orderHistoryList.innerHTML = historyHtml;
}

// ------------------------------------------- 
// イベントリスナーの追加
// ------------------------------------------- 
document.addEventListener('DOMContentLoaded', () => {
    // 既存のDOMContentLoadedイベントリスナーに注文履歴アイコンのイベントを追加
    const orderHistoryIcon = document.getElementById('order-history-icon');
    if (orderHistoryIcon) {
        orderHistoryIcon.addEventListener('click', openOrderHistoryModal);
    }
});

// モーダル外クリックで閉じる処理に注文履歴モーダルを追加
window.onclick = function(event) {
  const productModal = document.getElementById('product-modal');
  const orderConfirmModal = document.getElementById('order-confirm-modal');
  const resultModal = document.getElementById('result-modal');
  const orderStatusModal = document.getElementById('order-status-modal');
  const orderHistoryModal = document.getElementById('order-history-modal'); // 追加

  if (event.target == productModal) {
    closeModal();
  }
  if (event.target == orderConfirmModal) {
    closeOrderModal();
  }
  if (event.target == resultModal) {
    closeResultModal();
  }
  if (event.target == orderStatusModal) {
    closeOrderStatusModal();
  }
  if (event.target == orderHistoryModal) { // 追加
    closeOrderHistoryModal();
  }
}