const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby4pwwAzbWl5yavwF1tA5XfGgMuSNJBTKy_LILY-Z01wcnEIHQ7wYSFZy81SvpfyoEyUA/exec';
const POLLING_INTERVAL_MS = 5000; // 5秒ごとに更新

const loadingEl = document.getElementById('loading');
const errorMessageEl = document.getElementById('error-message');
const ordersTbody = document.getElementById('orders-tbody');

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
        displayError('注文データの取得に失敗しました。GASのURLまたは設定を確認してください。');
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

    orders.forEach(order => {
        const row = ordersTbody.insertRow();
        
        // 注文日時を整形
        const orderDateTime = new Date(order["注文日時"]);
        const formattedDateTime = orderDateTime.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        // 商品詳細を整形
        const productDetails = `
            <ul class="order-items-list">
                <li>${order["商品名"]} x ${order["数量"]} (${order["合計金額"]}円)</li>
            </ul>
        `;

        // ステータス選択ドロップダウン
        const statusSelect = document.createElement('select');
        statusSelect.className = 'status-select';
        ORDER_STATUSES.forEach(status => {
            const option = document.createElement('option');
            option.value = status.value;
            option.textContent = status.label;
            if (order["ステータス"] === status.value) {
                option.selected = true;
            }
            statusSelect.appendChild(option);
        });

        // ステータス更新ボタン
        const updateButton = document.createElement('button');
        updateButton.textContent = '更新';
        updateButton.className = 'update-status-btn';
        updateButton.onclick = () => updateOrderStatus(order.orderId, statusSelect.value);

        row.insertCell().textContent = order.orderId; // 注文ID (行番号)
        row.insertCell().textContent = formattedDateTime;
        row.insertCell().textContent = order["顧客名"];
        row.insertCell().innerHTML = productDetails;
        row.insertCell().textContent = order["合計金額"].toLocaleString() + '円';
        row.insertCell().textContent = order["特記事項"] || '-';
        
        const statusCell = row.insertCell();
        statusCell.appendChild(statusSelect);
        statusCell.classList.add(`status-${order["ステータス"].toLowerCase().replace(/ /g, '-')}`); // ステータスに応じたクラスを追加

        const actionCell = row.insertCell();
        actionCell.appendChild(updateButton);
    });
}

/**
 * 注文ステータスを更新する
 * @param {number} orderId - 更新する注文のID (スプレッドシートの行番号)
 * @param {string} newStatus - 新しいステータス
 */
async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await fetch(`${GAS_WEB_APP_URL}?action=doPost`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderStatus',
                orderId: orderId,
                newStatus: newStatus
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.status === 'success') {
            alert(`注文ID ${orderId} のステータスを ${newStatus} に更新しました。`);
            loadOrders(); // 更新後、リストを再読み込み
        } else {
            throw new Error(result.message || 'ステータス更新に失敗しました。');
        }
    } catch (error) {
        console.error('ステータス更新に失敗しました:', error);
        displayError(`ステータス更新に失敗しました: ${error.message}`);
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
    setInterval(() => loadOrders(false), POLLING_INTERVAL_MS); // ポーリング時は初回ロードではない
};
