import { loadDynamicQuestionsCommon, renderDynamicQuestionsCommon, getDynamicQuestionsDataCommon } from '../js/dynamic_form_common.js';

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyZEeRJFzVSya4TBN4mddhIMBb6_k-6B_FFLDEcFf_YFZRp1MM8fHr-12otS42DDd65/exec';
let dynamicQuestions = []; // 動的に生成される質問項目を保持する変数

// -------------------------------------------
// フォームの初期化
// -------------------------------------------
async function initializeReservationForm() {
    dynamicQuestions = await loadDynamicQuestionsCommon('room_reservation');
    renderDynamicQuestionsCommon(dynamicQuestions, 'dynamic-questions-container', 'room_reservation');

    // 日付の初期値を今日に設定
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    const reservationDateInput = document.getElementById('reservationDate');
    if (reservationDateInput) {
        reservationDateInput.value = todayString;
        reservationDateInput.min = todayString; // 過去の日付を選択できないようにする
    }
}

// -------------------------------------------
// バリデーション関数
// -------------------------------------------
function validateReservation() {
    const dynamicQuestionsData = getDynamicQuestionsDataCommon(dynamicQuestions); // 動的質問データを取得

    const reservationDateValue = dynamicQuestionsData['reservationDate'];
    const numberOfWeeks = parseInt(dynamicQuestionsData['numberOfWeeks']);
    const startTime = dynamicQuestionsData['startTime'];
    const endTime = dynamicQuestionsData['endTime'];

    if (!reservationDateValue) {
        openResultModal('入力エラー', '利用日を選択してください。');
        return false;
    }
    if (isNaN(numberOfWeeks) || numberOfWeeks < 1) {
        openResultModal('入力エラー', '連続予約週数は1以上の数値を入力してください。');
        return false;
    }
    if (!startTime || !endTime) {
        openResultModal('入力エラー', '開始時刻と終了時刻を選択してください。');
        return false;
    }

    const initialReservationDate = new Date(reservationDateValue);

    allReservationDates = []; // リセット

    for (let i = 0; i < numberOfWeeks; i++) {
        const reservationDate = new Date(initialReservationDate);
        reservationDate.setDate(initialReservationDate.getDate() + (i * 7)); // 1週間ずつ加算

        const today = new Date();
        today.setHours(0, 0, 0, 0); // 今日の日付の0時0分0秒に設定

        // 当日予約不可
        if (reservationDate <= today) {
            openResultModal('入力エラー', `予約日 ${reservationDate.toLocaleDateString()} は当日のため予約できません。翌日以降の日付を選択してください。`);
            return false;
        }

        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        // 開始時刻が毎時0分か30分であるか
        if (startMinute !== 0 && startMinute !== 30) {
            openResultModal('入力エラー', '開始時刻は毎時0分か30分を選択してください。');
            return false;
        }

        // 終了時刻が毎時0分か30分であるか
        if (endMinute !== 0 && endMinute !== 30) {
            openResultModal('入力エラー', '終了時刻は毎時0分か30分を選択してください。');
            return false;
        }

        const startDateTime = new Date(reservationDate);
        startDateTime.setHours(startHour, startMinute, 0, 0);
        const endDateTime = new Date(reservationDate);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        // 終了時刻が開始時刻より前または同じ場合
        if (endDateTime <= startDateTime) {
            openResultModal('入力エラー', '終了時刻は開始時刻より後に設定してください。');
            return false;
        }

        // 利用時間単位が1時間単位であるか
        const durationMinutes = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60);
        if (durationMinutes % 60 !== 0) {
            openResultModal('入力エラー', '利用時間は1時間単位で設定してください。');
            return false;
        }

        // 利用可能時間 09:00~21:00
        const earliestStartTime = new Date(reservationDate);
        earliestStartTime.setHours(9, 0, 0, 0);
        const latestEndTime = new Date(reservationDate);
        latestEndTime.setHours(21, 0, 0, 0);

        if (startDateTime < earliestStartTime || endDateTime > latestEndTime) {
            openResultModal('入力エラー', `予約日 ${reservationDate.toLocaleDateString()} の利用可能時間は09:00から21:00までです。`);
            return false;
        }
        allReservationDates.push(reservationDate.toISOString().split('T')[0]); // YYYY-MM-DD形式で保存
    }
    return true;
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

  // allReservationDates は validateReservation で設定済み
  const startTime = dynamicQuestionsData['startTime'];
  const endTime = dynamicQuestionsData['endTime'];

  // 予約情報をオブジェクトにまとめる
  currentReservation = {
    reservationDates: allReservationDates, // 連続予約の日付配列
    startTime,
    endTime,
    ...dynamicQuestionsData, // 動的な質問データをすべて含める
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
          value = value.length > 0 ? value.join(', ') : 'なし';
      } else if (!value) {
          value = 'なし'; // その他の未入力項目
      }
      
      detailsHtml += `<p><strong>${questionText}:</strong> ${value}</p>`;
  });

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
    ...currentReservation, // 現在の予約情報をペイロードに含める
    lineUserId: getLineUserId() // LINEユーザーIDを追加
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

// URLパラメータからLINEユーザー名を取得し、入力欄に設定
const lineNameFromUrl = urlParams.get('lineName');
if (lineNameFromUrl) {
    // 動的に生成される要素なので、DOMContentLoaded後にアクセスする必要がある
    // ここでは直接設定せず、initializeReservationForm内で設定するように変更
    // または、loadDynamicQuestionsが完了した後に設定する
    // 一旦、ここでは何もしないか、コメントアウトしておく
    // const contactNameInput = document.getElementById('contactName');
    // if (contactNameInput && !contactNameInput.value) { // 既に値がなければ自動入力
    //     contactNameInput.value = decodeURIComponent(lineNameFromUrl);
    // }
    // URLからlineNameパラメータを削除（URLをクリーンにするため）
    const newUrl = window.location.origin + window.location.pathname + window.location.search.replace(/&?lineName=[^&]*/, '');
    window.history.replaceState({}, document.title, newUrl);
}

window.onload = async () => {
    await initializeReservationForm();
    // LINEユーザー名がURLパラメータにある場合、動的に生成されたcontactNameフィールドに設定
    const lineNameFromUrl = urlParams.get('lineName');
    if (lineNameFromUrl) {
        const contactNameInput = document.getElementById('contactName');
        if (contactNameInput && !contactNameInput.value) {
            contactNameInput.value = decodeURIComponent(lineNameFromUrl);
        }
    }
};