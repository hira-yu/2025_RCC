

// グローバル変数として要素を宣言 (DOMContentLoaded内で初期化)
let orderStatusModal;
let customerOrderIdInput;
let checkOrderStatusBtn;
let customerOrderStatusResult;
let customerOrderDetails;

// openOrderStatusModal 関数はグローバルスコープで定義
function openOrderStatusModal() {
    // DOM要素が初期化されていることを確認
    if (!orderStatusModal) {
        console.error("DOM elements not initialized yet.");
        return;
    }
    orderStatusModal.style.display = 'flex';
    // モーダルが開かれたときに、セッションストレージに保存された注文IDがあれば自動で表示
    const lastOrderId = sessionStorage.getItem('lastOrderId');
    if (lastOrderId) {
        customerOrderIdInput.value = lastOrderId;
        fetchOrderStatus(lastOrderId);
    }
}

// closeOrderStatusModal 関数もグローバルスコープで定義
function closeOrderStatusModal() {
    if (!orderStatusModal) return; // 初期化されていない場合は何もしない
    orderStatusModal.style.display = 'none';
    // モーダルを閉じる際に表示内容をクリア
    customerOrderStatusResult.textContent = '';
    customerOrderDetails.innerHTML = '';
    customerOrderIdInput.value = '';
}

// 注文ステータスを取得して表示する関数
async function fetchOrderStatus(orderId) {
    customerOrderStatusResult.textContent = '注文情報を取得中...';
    customerOrderStatusResult.className = 'message';
    customerOrderDetails.innerHTML = '';

    try {
        const response = await fetch(`${GAS_WEB_APP_URL}?action=getOrderStatus&orderId=${orderId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }
        if (data.status === 'success' && data.order) {
            displayOrderStatus(data.order);
            customerOrderStatusResult.textContent = '';
        } else {
                customerOrderStatusResult.textContent = `注文ID: ${orderId} の情報が見つかりませんでした。`;
                customerOrderStatusResult.className = 'message error';
            }
        } catch (error) {
            console.error('注文ステータスの取得に失敗しました:', error);
            customerOrderStatusResult.textContent = `エラー: 注文ステータスの取得に失敗しました。${error.message}`;
            customerOrderStatusResult.className = 'message error';
        }
    }

// 注文ステータスを画面に表示する関数
function displayOrderStatus(order) {
    let itemsHtml = '';
    let totalAmount = 0;

    if (order.items && order.items.length > 0) {
        itemsHtml = '<ul class="order-items-list">';
        order.items.forEach(item => {
            const itemBasePrice = item.price;
            const itemOptionPriceAdjustment = item.optionPriceAdjustment || 0;
            const itemPriceWithOption = itemBasePrice + itemOptionPriceAdjustment;
            const itemTotal = itemPriceWithOption * item.quantity;
            totalAmount += itemTotal;
            let optionsDisplay = '';
            if (item.selectedOptions && item.selectedOptions.length > 0) {
                optionsDisplay = item.selectedOptions.map(opt => `${opt.groupName}: ${opt.optionValue}`).join(', ');
                optionsDisplay = `<br><small>(${optionsDisplay})</small>`;
            }
            itemsHtml += `<li>${item.name} x ${item.quantity} (${itemTotal.toLocaleString()}円)${optionsDisplay}</li>`;
        });
        itemsHtml += '</ul>';
    }

    const orderDateTime = new Date(order.orderDateTime);
    const formattedDateTime = orderDateTime.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    customerOrderDetails.innerHTML = `
        <h3>注文ID: ${order.orderId}</h3>
        <p><strong>注文日時:</strong> ${formattedDateTime}</p>
        <p><strong>顧客名:</strong> ${order.customerName}</p>
        <p><strong>ステータス:</strong> <span class="status-${order.status.toLowerCase().replace(/ /g, '-')}">${order.status}</span></p>
        <p><strong>合計金額:</strong> ${totalAmount.toLocaleString()}円</p>
        <p><strong>特記事項:</strong> ${order.notes || '-'}</p>
        <h4>注文内容:</h4>
        ${itemsHtml || '<p>商品情報がありません。</p>'} 
    `;
}

// DOMContentLoaded でイベントリスナーをアタッチ
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の初期化
    orderStatusModal = document.getElementById('order-status-modal');
    customerOrderIdInput = document.getElementById('customerOrderId');
    checkOrderStatusBtn = document.getElementById('checkOrderStatusBtn');
    customerOrderStatusResult = document.getElementById('customerOrderStatusResult');
    customerOrderDetails = document.getElementById('customerOrderDetails');

    checkOrderStatusBtn.addEventListener('click', () => {
        const orderId = customerOrderIdInput.value.trim();
        if (orderId) {
            sessionStorage.setItem('lastOrderId', orderId); // 注文IDをセッションストレージに保存
            fetchOrderStatus(orderId);
        } else {
            customerOrderStatusResult.textContent = '注文IDを入力してください。';
            customerOrderStatusResult.className = 'message error';
            customerOrderDetails.innerHTML = '';
        }
    });

    // 注文ステータスアイコンにイベントリスナーをアタッチ
    const orderStatusIcon = document.querySelector('.order-status-icon');
    if (orderStatusIcon) {
        orderStatusIcon.addEventListener('click', openOrderStatusModal);
    }

    // ページ読み込み時にセッションストレージから注文IDをチェック
    const lastOrderId = sessionStorage.getItem('lastOrderId');
    if (lastOrderId) {
        customerOrderIdInput.value = lastOrderId;
        fetchOrderStatus(lastOrderId);
    }
});

// グローバルスコープに関数を公開 (既にグローバルなので不要だが、明示的に残す)
window.openOrderStatusModal = openOrderStatusModal;
window.closeOrderStatusModal = closeOrderStatusModal;

