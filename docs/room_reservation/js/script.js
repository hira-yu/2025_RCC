const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyZEeRJFzVSya4TBN4mddhIMBb6_k-6B_FFLDEcFf_YFZRp1MM8fHr-12otS42DDd65/exec';

// 予約確認モーダル関連の要素
const reservationConfirmModal = document.getElementById('order-confirm-modal'); // IDはHTML側で変更済み
const reservationDetailsEl = document.getElementById('reservation-details');
const totalPriceDetailEl = document.getElementById('total-price-detail'); // 料金が発生する場合に利用
const messageEl = document.getElementById('message');

// フォーム要素
const reservationForm = document.getElementById('reservationForm');
const reservationDateInput = document.getElementById('reservationDate');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const purposeInput = document.getElementById('purpose');
const participantsInput = document.getElementById('participants');
const contactNameInput = document.getElementById('contactName');
const contactEmailInput = document.getElementById('contactEmail');
const contactPhoneInput = document.getElementById('contactPhone');
const equipmentSelect = document.getElementById('equipment');
const notesInput = document.getElementById('notes');
const confirmReservationBtn = document.getElementById('confirmReservationBtn');
const submitReservationBtn = document.getElementById('submit-reservation');

let currentReservation = {}; // 現在の予約情報を保持
let isSubmitting = false; // 多重送信防止フラグ

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
// 予約フォームの初期化
// ------------------------------------------- 
function initializeReservationForm() {
  // 今日の日付をデフォルト値に設定
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // 月は0から始まるため+1
  const dd = String(today.getDate()).padStart(2, '0');
  reservationDateInput.value = `${yyyy}-${mm}-${dd}`;

  // 予約確認ボタンのイベントリスナー
  confirmReservationBtn.addEventListener('click', openReservationConfirmModal);
  // 予約確定ボタンのイベントリスナー
  submitReservationBtn.addEventListener('click', submitReservation);
}

// ------------------------------------------- 
// 予約確認モーダルの制御
// ------------------------------------------- 
function openReservationConfirmModal() {
  // フォームのバリデーション
  if (!reservationForm.checkValidity()) {
    reservationForm.reportValidity();
    return;
  }

  // フォームデータを取得
  const reservationDate = reservationDateInput.value;
  const startTime = startTimeInput.value;
  const endTime = endTimeInput.value;
  const purpose = "​" + purposeInput.value;
  const participants = participantsInput.value;
  const contactName = "​" + contactNameInput.value;
  const contactEmail = contactEmailInput.value;
  const contactPhone = "​" + contactPhoneInput.value;
  const selectedEquipment = Array.from(equipmentSelect.selectedOptions).map(option => option.textContent);
  const notes = "​" + notesInput.value;

  // 予約情報をオブジェクトにまとめる
  currentReservation = {
    reservationDate,
    startTime,
    endTime,
    purpose,
    participants,
    contactName,
    contactEmail,
    contactPhone,
    equipment: selectedEquipment,
    notes
  };

  // モーダルに表示する内容を生成
  let detailsHtml = `
    <p><strong>利用日:</strong> ${reservationDate}</p>
    <p><strong>利用時間:</strong> ${startTime} - ${endTime}</p>
    <p><strong>利用目的:</strong> ${purpose}</p>
    <p><strong>参加人数:</strong> ${participants}名</p>
    <p><strong>代表者名:</strong> ${contactName}</p>
    <p><strong>メールアドレス:</strong> ${contactEmail}</p>
    <p><strong>電話番号:</strong> ${contactPhone || 'なし'}</p>
    <p><strong>利用備品:</strong> ${selectedEquipment.length > 0 ? selectedEquipment.join(', ') : 'なし'}</p>
    <p><strong>特記事項:</strong> ${notes || 'なし'}</p>
  `;

  reservationDetailsEl.innerHTML = detailsHtml;
  // 必要であれば、ここで料金計算を行いtotalPriceDetailElを更新
  totalPriceDetailEl.textContent = '0'; // 仮に0円

  reservationConfirmModal.style.display = 'inline-flex';
}

function closeReservationConfirmModal() {
  reservationConfirmModal.style.display = 'none';
}

// ------------------------------------------- 
// 予約データの送信
// ------------------------------------------- 
async function submitReservation() {
  submitReservationBtn.disabled = true;
  showLoadingOverlay();

  const payload = {
    action: 'submitReservation',
    ...currentReservation // 現在の予約情報をペイロードに含める
  };

  var postparam = {
    "method"     : "POST",
    "Content-Type" : "application/json", // JSONデータを送信するため修正
    "body" : JSON.stringify(payload)
  };

  if (isSubmitting) return; // 多重送信防止
  isSubmitting = true;

  try {
    const response = await fetch(GAS_WEB_APP_URL, postparam);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    handleReservationSuccess(result);
  } catch (error) {
    handleError('予約の送信に失敗しました: ' + error.message);
  }
}

async function handleReservationSuccess(response) {
  hideLoadingOverlay();
  submitReservationBtn.disabled = false;
  isSubmitting = false; // フラグをリセット
  
  if (response && response.status === 'success') {
    closeReservationConfirmModal();
    let successMessage = '✅ 予約は正常に送信されました！';
    if (response.reservationId) {
      successMessage += `\n予約ID: ${response.reservationId}`;
      // sessionStorage.setItem('lastReservationId', response.reservationId); // 必要であれば保存
    }
    openResultModal('予約完了', successMessage);
    // フォームをリセット
    reservationForm.reset();
    initializeReservationForm(); // 日付を今日に戻すため再初期化
  } else {
    handleError(response.message || '予約は失敗しました。');
  }
}

// ------------------------------------------- 
// エラーハンドリング関数 
// ------------------------------------------- 
function handleError(error) {
  hideLoadingOverlay();
  submitReservationBtn.disabled = false;
  isSubmitting = false; // フラグをリセット

  console.error("致命的なエラーが発生しました:", error);
  const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
  
  openResultModal('エラー', errorMessage);
}

// ------------------------------------------- 
// その他のイベントリスナー
// ------------------------------------------- 
// モーダル外クリックで閉じる処理
window.onclick = function(event) {
  const reservationConfirmModal = document.getElementById('order-confirm-modal');
  const resultModal = document.getElementById('result-modal');

  if (event.target == reservationConfirmModal) {
    closeReservationConfirmModal();
  }
  if (event.target == resultModal) {
    closeResultModal();
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

window.onload = initializeReservationForm;