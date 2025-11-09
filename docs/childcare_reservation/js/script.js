import { loadDynamicQuestionsCommon, renderDynamicQuestionsCommon, getDynamicQuestionsDataCommon } from '../../js/dynamic_form_common.js';

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyZEeRJFzVSya4TBN4mddhIMBb6_k-6B_FFLDEcFf_YFZRp1MM8fHr-12otS42DDd65/exec';
let dynamicQuestions = []; // 動的に生成される質問項目を保持する変数



// 予約確認モーダル関連の要素
const reservationConfirmModal = document.getElementById('order-confirm-modal');
const reservationDetailsEl = document.getElementById('reservation-details');
const totalPriceDetailEl = document.getElementById('total-price-detail');
const messageEl = document.getElementById('message');

// フォーム要素
const reservationForm = document.getElementById('reservationForm');
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
// ヘルパー関数：次の利用可能な水曜日を検索
// -------------------------------------------
function findNextAvailableWednesday(currentDate) {
  let date = new Date(currentDate);

  while (true) {
    const dayOfWeek = date.getDay(); // 日曜日が0、水曜日が3
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // 水曜日であるかチェック
    if (dayOfWeek === 3) {
      // 年末年始 (12月第4水曜日) とお盆期間 (8月第3水曜日) のチェック
      let isHoliday = false;

      // 12月第4水曜日
      if (month === 12) {
        const fourthWednesday = new Date(year, 11, 1); // 12月1日
        let count = 0;
        while (count < 4) {
          if (fourthWednesday.getDay() === 3) { // 水曜日
            count++;
          }
          if (count < 4) {
            fourthWednesday.setDate(fourthWednesday.getDate() + 1);
          }
        }
        if (date.toDateString() === fourthWednesday.toDateString()) {
          isHoliday = true;
        }
      }

      // 8月第3水曜日
      if (month === 8) {
        const thirdWednesday = new Date(year, 7, 1); // 8月1日
        let count = 0;
        while (count < 3) {
          if (thirdWednesday.getDay() === 3) { // 水曜日
            count++;
          }
          if (count < 3) {
            thirdWednesday.setDate(thirdWednesday.getDate() + 1);
          }
        }
        if (date.toDateString() === thirdWednesday.toDateString()) {
          isHoliday = true;
        }
      }

      if (!isHoliday) {
        return date;
      }
    }
    date.setDate(date.getDate() + 1);
  }
}

// -------------------------------------------
// 予約フォームの初期化
// -------------------------------------------
async function initializeReservationForm() {
  const now = new Date();
  let searchStartDate = new Date(now);
  let message = '';

  // 17時を過ぎていたら、検索開始日を翌日にする
  if (now.getHours() >= 17) {
    searchStartDate.setDate(now.getDate() + 1);
    message = '※現在時刻が17時を過ぎているため、最短予約日は翌日以降となります。\n';
  }

  // メッセージを表示
  if (message) {
    // 適切な場所にメッセージを表示する要素を追加するか、既存の要素を利用
    // 例: reservationForm の直後などに <p id="infoMessage"></p> を追加
    let infoMessageEl = document.getElementById('infoMessage');
    if (!infoMessageEl) {
      infoMessageEl = document.createElement('p');
      infoMessageEl.id = 'infoMessage';
      infoMessageEl.style.color = 'orange';
      reservationForm.parentNode.insertBefore(infoMessageEl, reservationForm.nextSibling);
    }
    infoMessageEl.textContent = message;
  }

  // 動的な質問を読み込む
  dynamicQuestions = await loadDynamicQuestionsCommon('childcare_reservation');
  renderDynamicQuestionsCommon(dynamicQuestions, 'dynamic-questions-container', 'childcare_reservation');

  // 予約確認ボタンのイベントリスナー
  confirmReservationBtn.addEventListener('click', openReservationConfirmModal);
  // 予約確定ボタンのイベントリスナー
  submitReservationBtn.addEventListener('click', submitReservation);
}

// -------------------------------------------
// バリデーション関数
// -------------------------------------------
function validateReservation() {
    const dynamicQuestionsData = getDynamicQuestionsDataCommon(dynamicQuestions); // 動的質問データを取得

    // 今日の日付を取得 (時刻情報は無視)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 予約日を取得 (時刻情報は無視)
    const reservationDateValue = dynamicQuestionsData['reservationDate'];
    if (!reservationDateValue) {
        openResultModal('入力エラー', '利用日を選択してください。');
        return false;
    }
    const reservationDate = new Date(reservationDateValue);
    reservationDate.setHours(0, 0, 0, 0);

    // 予約日が今日以前ではないことを確認
    if (reservationDate <= today) {
        openResultModal('入力エラー', '当日の予約は受け付けておりません。翌日以降の日付を選択してください。');
        return false;
    }

    const dayOfWeek = reservationDate.getDay(); // 日曜日が0、土曜日が6
    const month = reservationDate.getMonth() + 1;
    const day = reservationDate.getDate();
    const year = reservationDate.getFullYear();

    // 毎週水曜日のみ利用可能 (水曜日は3)
    if (dayOfWeek !== 3) {
        openResultModal('入力エラー', '一時預かりは毎週水曜日のみご利用いただけます。');
        return false;
    }

    // 年末年始 (12月第4水曜日) とお盆期間 (8月第3水曜日) のチェック
    // 12月第4水曜日
    if (month === 12) {
        const fourthWednesday = new Date(year, 11, 1); // 12月1日
        let count = 0;
        while (count < 4) {
            if (fourthWednesday.getDay() === 3) { // 水曜日
                count++;
            }
            if (count < 4) {
                fourthWednesday.setDate(fourthWednesday.getDate() + 1);
            }
        }
        if (reservationDate.toDateString() === fourthWednesday.toDateString()) {
            openResultModal('入力エラー', '年末年始期間（12月第4水曜日）はご利用いただけません。');
            return false;
        }
    }

    // 8月第3水曜日
    if (month === 8) {
        const thirdWednesday = new Date(year, 7, 1); // 8月1日
        let count = 0;
        while (count < 3) {
            if (thirdWednesday.getDay() === 3) { // 水曜日
                count++;
            }
            if (count < 3) {
                thirdWednesday.setDate(thirdWednesday.getDate() + 1);
            }
        }
        if (reservationDate.toDateString() === thirdWednesday.toDateString()) {
            openResultModal('入力エラー', 'お盆期間（8月第3水曜日）はご利用いただけません。');
            return false;
        }
    }

    const startTime = dynamicQuestionsData['startTime'];
    const usageTime = parseInt(dynamicQuestionsData['usageTime']);

    if (!startTime || isNaN(usageTime)) {
        openResultModal('入力エラー', '利用開始時刻と利用時間を選択してください。');
        return false;
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    // 利用開始時刻が15分単位であるかチェック
    if (startMinute % 15 !== 0) {
        openResultModal('入力エラー', '利用開始時刻は15分単位で入力してください。');
        return false;
    }
    const startDateTime = new Date(reservationDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    // 利用可能時間 09:30~17:30
    const earliestStartTime = new Date(reservationDate);
    earliestStartTime.setHours(9, 30, 0, 0);
    const latestEndTime = new Date(reservationDate);
    latestEndTime.setHours(17, 30, 0, 0);

    if (startDateTime < earliestStartTime) {
        openResultModal('入力エラー', '利用開始時刻は09:30以降に設定してください。');
        return false;
    }

    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(startDateTime.getHours() + usageTime);

    if (endDateTime > latestEndTime) {
        openResultModal('入力エラー', '利用終了時刻が17:30を超過します。');
        return false;
    }

    // 最終預かりは16:30
    const finalDropOffTime = new Date(reservationDate);
    finalDropOffTime.setHours(16, 30, 0, 0);
    if (startDateTime > finalDropOffTime) {
        openResultModal('入力エラー', '最終預かりは16:30です。');
        return false;
    }

    const childAge = parseInt(dynamicQuestionsData['childAge']);
    if (isNaN(childAge) || childAge < 0 || childAge > 15) {
        openResultModal('入力エラー', 'お子様の年齢は0歳から15歳までで入力してください。');
        return false;
    }

    const childGender = dynamicQuestionsData['childGender'];
    if (!childGender) {
        openResultModal('入力エラー', 'お子様の性別を選択してください。');
        return false;
    }

    return true;
}

// -------------------------------------------
// 料金計算関数
// -------------------------------------------
function calculatePrice(usageTime) {
    const pricePerHour = 500;
    return usageTime * pricePerHour;
}

// -------------------------------------------
// 予約確認モーダルの制御
// -------------------------------------------
function openReservationConfirmModal() {
  // フォームのバリデーション
  if (!reservationForm.checkValidity() || !validateReservation()) {
    reservationForm.reportValidity();
    return;
  }

  // 動的に生成された質問のデータを取得
  const dynamicQuestionsData = getDynamicQuestionsDataCommon(dynamicQuestions);

  // 必須項目のバリデーション (getDynamicQuestionsDataでは行わないためここで実施)
  let allRequiredFilled = true;
  dynamicQuestions.forEach(question => {
      if (question.is_required) {
          const value = dynamicQuestionsData[question.question_key];
          if (question.input_type === 'checkbox') {
              if (!value || value.length === 0) {
                  allRequiredFilled = false;
                  openResultModal('入力エラー', `${question.question_text} は必須項目です。`);
              }
          } else {
              if (!value) {
                  allRequiredFilled = false;
                  openResultModal('入力エラー', `${question.question_text} は必須項目です。`);
              }
          }
      }
  });

  if (!allRequiredFilled) {
      return;
  }

  const usageTime = parseInt(dynamicQuestionsData['usageTime']);
  const totalPrice = calculatePrice(usageTime);

  // 予約情報をオブジェクトにまとめる
  currentReservation = {
    ...dynamicQuestionsData, // 動的な質問データをすべて含める
    totalPrice: totalPrice,
    lineUserId: getLineUserId() // LINEユーザーIDを追加
  };

  // モーダルに表示する内容を生成
  let detailsHtml = '';
  dynamicQuestions.forEach(question => {
      const questionText = question.question_text;
      let value = dynamicQuestionsData[question.question_key];

      if (question.input_type === 'select' && value === '') {
          value = '未選択'; // セレクトボックスで未選択の場合
      } else if (question.input_type === 'checkbox' && Array.isArray(value)) {
          value = value.length > 0 ? value.join(', ') : '未選択';
      } else if (!value) {
          value = 'なし'; // その他の未入力項目
      }

      // childGender の表示を調整
      if (question.question_key === 'childGender') {
          value = value === 'male' ? '男' : value === 'female' ? '女' : value === 'other' ? 'その他' : value;
      }
      
      detailsHtml += `<p><strong>${questionText}:</strong> ${value}</p>`;
  });

  reservationDetailsEl.innerHTML = detailsHtml;
  totalPriceDetailEl.textContent = totalPrice;

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
    action: 'submitChildReservation', // GAS側で処理を分けるためにアクション名を変更
    ...currentReservation, // 現在の予約情報をペイロードに含める
    lineUserId: getLineUserId() // LINEユーザーIDを追加
  };

  var postparam = {
    "method"     : "POST",
    "Content-Type" : "application/json",
    "body" : JSON.stringify(payload)
  };

  if (isSubmitting) return;
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
  } finally {
    submitReservationBtn.disabled = false;
    isSubmitting = false; // フラグをリセット
  }
}

async function handleReservationSuccess(response) {
  hideLoadingOverlay();
  
  if (response && response.status === 'success') {
    closeReservationConfirmModal();
    let successMessage = '✅ 予約は正常に送信されました！';
    if (response.reservationId) {
      successMessage += `\n予約ID: ${response.reservationId}`;
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
  
  console.error("致命的なエラーが発生しました:", error);
  const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
  
  openResultModal('エラー', errorMessage);
}

// -------------------------------------------
// その他のイベントリスナー
// -------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // reservationConfirmModal の閉じるボタンにイベントリスナーを追加
  const reservationConfirmModalCloseButton = reservationConfirmModal.querySelector('.close');
  if (reservationConfirmModalCloseButton) {
      reservationConfirmModalCloseButton.addEventListener('click', closeReservationConfirmModal);
  }

  // resultModal の閉じるボタンにイベントリスナーを追加
  const resultModal = document.getElementById('result-modal');
  const resultModalCloseButton = resultModal.querySelector('.close');
  if (resultModalCloseButton) {
      resultModalCloseButton.addEventListener('click', closeResultModal);
  }

  // resultModal 内の「閉じる」ボタンにイベントリスナーを追加
  const resultModalPrimaryButton = resultModal.querySelector('.btn-primary');
  if (resultModalPrimaryButton) {
      resultModalPrimaryButton.addEventListener('click', closeResultModal);
  }
});

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

// URLパラメータからLINEユーザー名を取得し、入力欄に設定
const lineNameFromUrl = urlParams.get('lineName');
if (lineNameFromUrl) {
    // 動的に生成される要素なので、DOMContentLoaded後にアクセスする必要がある
    // ここでは直接設定せず、initializeReservationForm内で設定するように変更
    // または、loadDynamicQuestionsが完了した後に設定する
    // 一旦、ここでは何もしないか、コメントアウトしておく
    // const parentNameInput = document.getElementById('parentName');
    // if (parentNameInput && !parentNameInput.value) { // 既に値がなければ自動入力
    //     parentNameInput.value = decodeURIComponent(lineNameFromUrl);
    // }
    // URLからlineNameパラメータを削除（URLをクリーンにするため）
    const newUrl = window.location.origin + window.location.pathname + window.location.search.replace(/&?lineName=[^&]*/, '');
    window.history.replaceState({}, document.title, newUrl);
}

window.onload = async () => {
    await initializeReservationForm();
    // LINEユーザー名がURLパラメータにある場合、動的に生成されたparentNameフィールドに設定
    const lineNameFromUrl = urlParams.get('lineName');
    if (lineNameFromUrl) {
        const parentNameInput = document.getElementById('parentName');
        if (parentNameInput && !parentNameInput.value) {
            parentNameInput.value = decodeURIComponent(lineNameFromUrl);
        }
    }
};