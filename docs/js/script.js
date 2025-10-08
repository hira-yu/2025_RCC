const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby4pwwAzbWl5yavwF1tA5XfGgMuSNJBTKy_LILY-Z01wcnEIHQ7wYSFZy81SvpfyoEyUA/exec';
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

function showLoadingOverlay() {
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoadingOverlay() {
  document.getElementById('loading-overlay').style.display = 'none';
}


// -------------------------------------------
// 商品データの取得と表示
// -------------------------------------------
async function loadProducts() {
  messageEl.textContent = '';
  try {
    const response = await fetch(`${GAS_WEB_APP_URL}?action=getProductsData`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const products = await response.json();
    displayProducts(products);
  } catch (error) {
    handleError('商品データの取得に失敗しました: ' + error.message);
  }
}

function displayProducts(products) {
  console.log("GASから受信した商品データ:", products);
  document.getElementById('loading').style.display = 'none';

  if (products.error || products.length === 0) {
    handleError(products.error || '商品データが見つかりませんでした。Spread Sheetを確認してください。');
    return;
  }
  
  // ★ 取得した商品データを全体で保持する
  productsData = products;

  productListEl.innerHTML = '';
  
  products.forEach(product => {
    // 初回はカートに商品オブジェクトを登録しておく
    cart[product.id] = { 
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 0
    };

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
  document.getElementById('product-modal').style.display = 'inline-flex';
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
  
  qtyInput.value = newValue;
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
  const modalMessageEl = document.getElementById('modal-message');

  if (quantity <= 0) {
    modalMessageEl.textContent = '数量は1以上で入力してください。';
    return;
  }

  // カートを更新
  cart[currentProduct.id].quantity = quantity;
  
  modalMessageEl.textContent = `✅ ${currentProduct.name}を${quantity}個カートに追加しました。`;
  
  // モーダルを閉じてカートの状態を更新
  setTimeout(closeModal, 1000); 
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
    let detailHtml = '';
    let total = 0;
    let totalItemsCount = 0; // 商品の種類の数

    for (const id in cart) {
      const item = cart[id];
      if (item.quantity > 0) {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        totalItemsCount += item.quantity; // 全商品の合計数量をカウント
        detailHtml += `<p>${item.name} x ${item.quantity} = ${itemTotal.toLocaleString()}円</p>`;
      }
    }

    if (totalItemsCount === 0) {
      detailHtml = 'カートは空です。';
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
  showLoadingOverlay(); // ローディングオーバーレイを表示
  messageEl.textContent = '注文を送信中...';
  document.getElementById('submit-order').disabled = true;

  const customerName = document.getElementById('customerName').value.trim();
  const notes = document.getElementById('notes').value;
  
  if (!customerName) {
      messageEl.textContent = 'エラー: お名前を入力してください。';
      document.getElementById('submit-order').disabled = false;
      return;
  }

  const itemsToOrder = Object.values(cart).filter(item => item.quantity > 0);
  
  if (itemsToOrder.length === 0) {
      messageEl.textContent = 'エラー: 注文する商品がありません。';
      document.getElementById('submit-order').disabled = false;
      return;
  }

  const payload = {
    action: 'submitOrder',
    customerName: customerName,
    notes: notes,
    items: itemsToOrder
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
    handleOrderSuccess(result);
  } catch (error) {
    handleError('注文の送信に失敗しました: ' + error.message);
  }

}

async function handleOrderSuccess(response) {
  hideLoadingOverlay(); // ローディングオーバーレイを非表示
  document.getElementById('submit-order').disabled = false;
  
  if (response && response.status === 'success') {
    messageEl.textContent = '✅ 注文は正常に送信されました！';
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
  messageEl.textContent = '❌ エラーが発生しました: ' + (typeof error === 'string' ? error : JSON.stringify(error));
  
  // モーダルが開いている場合は閉じる（モーダル内エラーの場合を想定）
  document.getElementById('modal-message').textContent = '';
}

// -------------------------------------------
// その他のイベントリスナー
// -------------------------------------------
// モーダル外クリックで閉じる処理
window.onclick = function(event) {
  const modal = document.getElementById('product-modal');
  if (event.target == modal) {
    closeModal();
  }
}

window.onload = loadProducts;
