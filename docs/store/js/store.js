const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby4pwwAzbWl5yavwF1tA5XfGgMuSNJBTKy_LILY-Z01wcnEIHQ7wYSFZy81SvpfyoEyUA/exec';
const POLLING_INTERVAL_MS = 5000; // 5秒ごとに更新

const loadingEl = document.getElementById('loading');
const errorMessageEl = document.getElementById('error-message');
const ordersTbody = document.getElementById('orders-tbody');

let pollingIntervalId; // ★ 追加: setIntervalのIDを保持する変数

// 注文ステータスの選択肢
const ORDER_STATUSES = [
    { value: "新規", label: "新規" },
    { value: "受付済み", label: "受付済み" },
    { value: "調理中", label: "調理中" },
    { value: "配達中", label: "配達中" },
    { value: "完了", label: "完了" },
    { value: "キャンセル", label: "キャンセル" }
];

/**
 * エラーメッセージを表示する
 * @param {string} message - 表示するエラーメッセージ
 */
function displayError(message) {
    errorMessageEl.textContent = `エラー: ${message}`;
    errorMessageEl.style.display = 'block';
    loadingEl.style.display = 'none';
}

/**
 * 注文データをGASから取得する
 * @returns {Promise<Array>} 注文データの配列
 */
async function fetchOrders() {
    try {
        const response = await fetch(`${GAS_WEB_APP_URL}?action=getOrders`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data;
    } catch (error) {
        console.error('注文データの取得に失敗しました:', error);
        displayError('注文データの取得に失敗しました。インターネット接続を確認してください。');
        return [];
    }
}

/**
 * 注文データを画面にレンダリングする
 * @param {Array} orders - 注文データの配列
 */
function renderOrders(orders) {
    ordersTbody.innerHTML = ''; // 既存のリストをクリア

    if (orders.length === 0) {
        ordersTbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">現在、注文はありません。</td></tr>';
        return;
    }

    // 注文をorderIdでグループ化
    const groupedOrders = orders.reduce((acc, currentOrder) => {
        const orderId = currentOrder.orderId;
        if (!acc[orderId]) {
            acc[orderId] = {
                orderId: orderId,
                orderDateTime: currentOrder["注文日時"],
                customerName: currentOrder["顧客名"],
                totalAmount: 0, // 後で計算
                notes: currentOrder["特記事項"],
                status: currentOrder["ステータス"],
                items: []
            };
        }
        acc[orderId].items.push({
            productName: currentOrder["商品名"],
            quantity: currentOrder["数量"],
            itemAmount: currentOrder["合計金額"],
            selectedOptions: currentOrder["選択オプション"] || '' // 選択オプションを追加
        });
        // 注文全体の合計金額を計算
        acc[orderId].totalAmount += currentOrder["合計金額"];
        // 注文全体の選択オプションを保持 (最初のアイテムのオプションを使用)
        if (!acc[orderId].selectedOptions) {
            acc[orderId].selectedOptions = currentOrder["選択オプション"] || '-';
        }
        return acc;
    }, {});

    // グループ化された注文をループしてレンダリング
    Object.values(groupedOrders).forEach(order => {
        const row = ordersTbody.insertRow();
        
        // 注文日時を整形
        const orderDateTime = new Date(order.orderDateTime);
        const formattedDateTime = orderDateTime.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        // 商品詳細を整形
        const productDetails = `
            <ul class="order-items-list">
                ${order.items.map(item => `
                    <li>
                        ${item.productName} x ${item.quantity} (${item.itemAmount}円)
                        ${item.selectedOptions ? `<br><small>(${item.selectedOptions})</small>` : ''}
                    </li>
                `).join('')}
            </ul>
        `;

        // ステータス選択ドロップダウン
        const statusSelect = document.createElement('select');
        statusSelect.className = 'status-select';
        statusSelect.onfocus = () => clearInterval(pollingIntervalId); // ★ 追加: フォーカス時に自動更新を一時停止
        ORDER_STATUSES.forEach(status => {
            const option = document.createElement('option');
            option.value = status.value;
            option.textContent = status.label;
            if (order.status === status.value) {
                option.selected = true;
            }
            statusSelect.appendChild(option);
        });

        // ステータス更新ボタン
        const updateButton = document.createElement('button');
        updateButton.textContent = '更新';
        updateButton.className = 'update-status-btn btn btn-primary';
        updateButton.onclick = () => updateOrderStatus(order.orderId, statusSelect.value, updateButton); // ★ updateButtonを引数に追加

        row.insertCell().textContent = order.orderId; // 注文ID
        row.insertCell().textContent = formattedDateTime;
        row.insertCell().textContent = order.customerName;
        row.insertCell().innerHTML = productDetails;
        row.insertCell().textContent = order.selectedOptions || '-'; // 選択オプション列
        row.insertCell().textContent = order.totalAmount.toLocaleString() + '円';
        row.insertCell().textContent = order.notes || '-';
        
        const statusCell = row.insertCell();
        statusCell.appendChild(statusSelect);
        statusCell.classList.add(`status-${order.status.toLowerCase().replace(/ /g, '-')}`); // ステータスに応じたクラスを追加

        const actionCell = row.insertCell();
        actionCell.appendChild(updateButton);
    });
}

/**
 * スナックバーを表示する
 * @param {string} message - 表示するメッセージ
 */
function showSnackbar(message) {
    const snackbar = document.getElementById("snackbar");
    snackbar.textContent = message;
    snackbar.className = "show";
    setTimeout(function(){ snackbar.className = snackbar.className.replace("show", ""); }, 3000);
}

/**
 * 注文ステータスを更新する
 * @param {number} orderId - 更新する注文のID (スプレッドシートの行番号)
 * @param {string} newStatus - 新しいステータス
 * @param {HTMLElement} button - 更新ボタンの要素
 */
async function updateOrderStatus(orderId, newStatus, button) { // ★ button引数を追加
    // ★ 自動更新を一時停止
    clearInterval(pollingIntervalId);

    if (button) { // ★ ボタンを無効化
        button.disabled = true;
        button.textContent = '更新中...';
    }

    const payload = {
        action: 'updateOrderStatus',
        orderId: orderId,
        newStatus: newStatus
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
            showSnackbar(`注文ID ${orderId} のステータスを ${newStatus} に更新しました。`);
            await loadOrders();
        } else {
            throw new Error(result.message || 'ステータス更新に失敗しました。');
        }
    } catch (error) {
        console.error('ステータス更新に失敗しました:', error);
        displayError(`ステータス更新に失敗しました: ${error.message}`);
    } finally {
        if (button) { // ★ ボタンを有効化
            button.disabled = false;
            button.textContent = '更新';
        }
        // ★ 自動更新を再開
        pollingIntervalId = setInterval(() => loadOrders(false), POLLING_INTERVAL_MS);
    }
}

/**
 * 注文データをロードし、レンダリングする
 */
async function loadOrders(initialLoad = false) {
    if (initialLoad) {
        loadingEl.style.display = 'block';
    }
    errorMessageEl.style.display = 'none';
    const orders = await fetchOrders();
    renderOrders(orders);
    if (initialLoad) {
        loadingEl.style.display = 'none';
    }
}

// ページロード時に注文データを読み込み、ポーリングを開始
window.onload = () => {
    loadOrders(true); // 初回ロードであることを伝える
    pollingIntervalId = setInterval(() => loadOrders(false), POLLING_INTERVAL_MS); // ポーリング時は初回ロードではない
};
