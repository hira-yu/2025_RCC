const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyZEeRJFzVSya4TBN4mddhIMBb6_k-6B_FFLDEcFf_YFZRp1MM8fHr-12otS42DDd65/exec'; // ★要更新: 集会所予約用のGAS Web App URL

const reservationTableBody = document.querySelector('#reservationTable tbody');
const statusFilter = document.getElementById('statusFilter');
const refreshButton = document.getElementById('refreshButton');
let messageEl; // letに変更し、後で初期化

// 確認モーダル関連の要素
const confirmActionModal = document.getElementById('confirm-action-modal');
const confirmActionTitle = document.getElementById('confirm-action-title');
const confirmActionMessage = document.getElementById('confirm-action-message');
const confirmActionButton = document.getElementById('confirmActionButton');

let currentActionReservationId = null;
let currentActionNewStatus = null;

let allReservations = []; // 全ての予約データを保持

const statusMap = {
  "Pending": "承認待ち",
  "Approved": "承認済み",
  "Rejected": "却下済み",
  "Cancelled": "キャンセル済み"
};

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
// 予約データの取得
// -------------------------------------------
async function fetchReservations() {
  showLoadingOverlay();
  if (messageEl) messageEl.textContent = ''; // messageElがnullでないことを確認
  try {
    const response = await fetch(`${GAS_WEB_APP_URL}?action=getReservations`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (result.status === 'success') {
      allReservations = result.reservations; // 取得したデータを保存
      renderReservations(); // データを表示
    } else {
      handleError(result.message || '予約データの取得に失敗しました。');
    }
  } catch (error) {
    handleError('予約データの取得中にエラーが発生しました: ' + error.message);
  } finally {
    hideLoadingOverlay();
  }
}

// -------------------------------------------
// 予約データの表示
// -------------------------------------------
function renderReservations() {
  reservationTableBody.innerHTML = ''; // テーブルをクリア

  const filterStatus = statusFilter.value;
  const filteredReservations = allReservations.filter(reservation => {
    return filterStatus === 'all' || reservation.Status === filterStatus;
  });

  if (filteredReservations.length === 0) {
    reservationTableBody.innerHTML = '<tr><td colspan="12" style="text-align: center;">表示する予約がありません。</td></tr>';
    return;
  }

  filteredReservations.forEach(reservation => {
    const row = reservationTableBody.insertRow();
    const displayStatus = statusMap[reservation.Status] || reservation.Status; // 日本語表示に変換

    let actionButtonsHtml = '';
    if (reservation.Status === 'Pending') {
      actionButtonsHtml = `
        <button class="approve-btn" data-id="${reservation['Reservation ID']}" data-status="Approved">承認</button>
        <button class="reject-btn" data-id="${reservation['Reservation ID']}" data-status="Rejected">却下</button>
      `;
    } else if (reservation.Status === 'Approved') {
      actionButtonsHtml = `
        <button class="cancel-btn" data-id="${reservation['Reservation ID']}" data-status="Cancelled">キャンセル</button>
      `;
    } else if (reservation.Status === 'Rejected' || reservation.Status === 'Cancelled') {
      actionButtonsHtml = `
        <!-- No action buttons for Rejected or Cancelled reservations -->
      `;
    }

    row.innerHTML = `
      <td>${reservation['Reservation ID']}</td>
      <td class="status-${reservation.Status}">${displayStatus}</td>
      <td>${reservation['Reservation Date']}</td>
      <td>${reservation['Start Time']} - ${reservation['End Time']}</td>
      <td>${reservation.Purpose}</td>
      <td>${reservation.Participants}</td>
      <td>${reservation['Contact Name']}</td>
      <td>${reservation['Contact Email']}</td>
      <td>${reservation['Contact Phone'] || ''}</td>
      <td>${reservation.Equipment || ''}</td>
      <td>${reservation.Notes || ''}</td>
      <td class="action-buttons">
        ${actionButtonsHtml}
      </td>
    `;

    // アクションボタンにイベントリスナーを追加
    const approveBtn = row.querySelector('.approve-btn');
    if (approveBtn) {
      approveBtn.addEventListener('click', (e) => openConfirmActionModal(e.target.dataset.id, e.target.dataset.status));
    }
    const rejectBtn = row.querySelector('.reject-btn');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', (e) => openConfirmActionModal(e.target.dataset.id, e.target.dataset.status));
    }
    const cancelBtn = row.querySelector('.cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => openConfirmActionModal(e.target.dataset.id, e.target.dataset.status));
    }
  });
}

// -------------------------------------------
// 確認モーダルの制御
// -------------------------------------------
function openConfirmActionModal(reservationId, newStatus) {
  currentActionReservationId = reservationId;
  currentActionNewStatus = newStatus;

  confirmActionTitle.textContent = '予約ステータス変更の確認';
  let message = '';
  if (newStatus === 'Approved') {
    message = `予約ID: ${reservationId} を承認しますか？`;
  } else if (newStatus === 'Rejected') {
    message = `予約ID: ${reservationId} を却下しますか？`;
  } else if (newStatus === 'Cancelled') {
    message = `予約ID: ${reservationId} をキャンセルしますか？`;
  }
  confirmActionMessage.textContent = message;
  confirmActionButton.onclick = () => executeStatusChange(currentActionReservationId, currentActionNewStatus); // 「はい」ボタンに実行関数を割り当て

  confirmActionModal.style.display = 'inline-flex';
}

function closeConfirmActionModal() {
  confirmActionModal.style.display = 'none';
  currentActionReservationId = null;
  currentActionNewStatus = null;
}

// -------------------------------------------
// 予約ステータスの更新実行
// -------------------------------------------
async function executeStatusChange(reservationId, newStatus) {
  closeConfirmActionModal(); // 確認モーダルを閉じる
  showLoadingOverlay();

  // const reservationId = currentActionReservationId; // グローバル変数からの取得は不要
  // const newStatus = currentActionNewStatus;       // グローバル変数からの取得は不要

  try {
    const payload = {
      action: 'updateReservationStatus',
      reservationId: reservationId,
      newStatus: newStatus
    };

    const postparam = {
      "method"     : "POST",
      "Content-Type" : "application/json",
      "body" : JSON.stringify(payload)
    };

    const response = await fetch(GAS_WEB_APP_URL, postparam);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();

    if (result.status === 'success') {
      openResultModal('成功', `予約ID: ${reservationId} のステータスを ${statusMap[newStatus] || newStatus} に更新しました。`); // 日本語表示に変換
      fetchReservations(); // 更新後にデータを再取得して表示を更新
    } else {
      handleError(result.message || 'ステータスの更新に失敗しました。');
    }
  } catch (error) {
    handleError('ステータス更新中にエラーが発生しました: ' + error.message);
  } finally {
    hideLoadingOverlay();
  }
}

// -------------------------------------------
// エラーハンドリング関数 
// -------------------------------------------
function handleError(error) {
  hideLoadingOverlay();
  console.error("エラーが発生しました:", error);
  const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
  openResultModal('エラー', errorMessage);
}

// -------------------------------------------
// イベントリスナー
// -------------------------------------------
statusFilter.addEventListener('change', renderReservations);
refreshButton.addEventListener('click', fetchReservations);

window.onload = () => {
  messageEl = document.getElementById('message'); // DOMがロードされてから初期化
  fetchReservations();
};

// モーダル外クリックで閉じる処理
window.onclick = function(event) {
  const resultModal = document.getElementById('result-modal');
  const confirmActionModal = document.getElementById('confirm-action-modal'); // 追加

  if (event.target == resultModal) {
    closeResultModal();
  }
  if (event.target == confirmActionModal) { // 追加
    closeConfirmActionModal();
  }
}
