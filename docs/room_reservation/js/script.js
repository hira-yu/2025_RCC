const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyZEeRJFzVSya4TBN4mddhIMBb6_k-6B_FFLDEcFf_YFZRp1MM8fHr-12otS42DDd65/exec';
const API_ENDPOINT = 'https://momoport.hirayu.jp/php/get_form_questions.php'; // 認証不要な質問取得APIエンドポイントに変更
let dynamicQuestions = []; // 動的に生成される質問項目を保持する変数

// 予約確認モーダル関連の要素
const reservationConfirmModal = document.getElementById('order-confirm-modal'); // IDはHTML側で変更済み
const reservationDetailsEl = document.getElementById('reservation-details');
const totalPriceDetailEl = document.getElementById('total-price-detail'); // 料金が発生する場合に利用
const messageEl = document.getElementById('message');

// フォーム要素
const reservationForm = document.getElementById('reservationForm');
const confirmReservationBtn = document.getElementById('confirmReservationBtn');
const submitReservationBtn = document.getElementById('submit-reservation');

let currentReservation = {}; // 現在の予約情報を保持
let isSubmitting = false; // 多重送信防止フラグ
let allReservationDates = []; // 連続予約の全日付を保持する配列

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
// 動的な質問を読み込み、フォームに生成する
// -------------------------------------------
async function loadDynamicQuestions() {
  try {
    const response = await fetch(`${API_ENDPOINT}?form_name=room_reservation`); // form_nameを修正
    const data = await response.json();

    if (data.status === 'success' && data.questions) {
      dynamicQuestions = data.questions; // 質問データを保持
      const dynamicQuestionsContainer = document.getElementById('dynamic-questions-container'); // 既存の要素を取得
      dynamicQuestionsContainer.innerHTML = ''; // 既存の内容をクリア

      dynamicQuestions.sort((a, b) => a.order_num - b.order_num).forEach(question => {
        const questionGroup = document.createElement('div');
        questionGroup.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = question.question_text; // コロンはHTML側で追加しない
        if (question.is_required) {
          label.innerHTML += ' <span class="required">*</span>';
        }
        questionGroup.appendChild(label);

        let inputElement;
        switch (question.input_type) {
          case 'text':
          case 'number':
          case 'email': // emailタイプを追加
          case 'tel': // telタイプを追加
          case 'date': // dateタイプを追加
          case 'time': // timeタイプを追加
            inputElement = document.createElement('input');
            inputElement.type = question.input_type;
            inputElement.name = question.question_key;
            inputElement.id = question.question_key;
            if (question.is_required) inputElement.required = true;
            // timeタイプの場合、step属性を追加
            if (question.input_type === 'time') {
                inputElement.step = '1800'; // 30分単位
            }
            // numberタイプの場合、min/max属性を追加 (numberOfWeeks, participants用)
            if (question.question_key === 'numberOfWeeks' || question.question_key === 'participants') {
                inputElement.min = '1';
                inputElement.value = '1'; // 初期値
            }
            break;
          case 'textarea':
            inputElement = document.createElement('textarea');
            inputElement.name = question.question_key;
            inputElement.id = question.question_key;
            if (question.is_required) inputElement.required = true;
            break;
          case 'select':
            inputElement = document.createElement('select');
            inputElement.name = question.question_key;
            inputElement.id = question.question_key;
            if (question.is_required) inputElement.required = true;
            // select multiple の場合
            if (question.question_key === 'equipment') {
                inputElement.multiple = true;
            }
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '選択してください';
            inputElement.appendChild(defaultOption);
            if (question.options) {
              JSON.parse(question.options).forEach(optionText => {
                const option = document.createElement('option');
                option.value = optionText;
                option.textContent = optionText;
                inputElement.appendChild(option);
              });
            }
            break;
          case 'radio':
          case 'checkbox':
            inputElement = document.createElement('div'); // ラジオボタン/チェックボックスはグループ化するためdiv
            inputElement.id = question.question_key;
            if (question.is_required && question.input_type === 'radio') {
              inputElement.dataset.isRequired = 'true'; // ラジオボタングループに必須属性を追加
            }
            if (question.options) {
              JSON.parse(question.options).forEach(optionText => {
                const optionId = `${question.question_key}-${optionText.replace(/\s/g, '-')}`;
                const radioOrCheckbox = document.createElement('input');
                radioOrCheckbox.type = question.input_type;
                radioOrCheckbox.name = question.question_key;
                radioOrCheckbox.id = optionId;
                radioOrCheckbox.value = optionText;
                // required属性は個々のラジオボタンにはつけない
                const optionLabel = document.createElement('label');
                optionLabel.htmlFor = optionId;
                optionLabel.textContent = optionText;
                inputElement.appendChild(radioOrCheckbox);
                inputElement.appendChild(optionLabel);
                inputElement.appendChild(document.createElement('br'));
              });
            }
            break;
          default:
            console.warn(`Unknown input type: ${question.input_type}`);
            return;
        }
        questionGroup.appendChild(inputElement);
        dynamicQuestionsContainer.appendChild(questionGroup);
      });
    } else {
      console.error('Failed to load dynamic questions:', data.message);
    }
  } catch (error) {
    console.error('Error loading dynamic questions:', error);
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
    message = '※現在時刻が17時を過ぎているため、最短予約日は翌々日以降となります。\n';
  }

  // メッセージを表示
  if (message) {
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
  await loadDynamicQuestions();

  // 予約確認ボタンのイベントリスナー
  confirmReservationBtn.addEventListener('click', openReservationConfirmModal);
  // 予約確定ボタンのイベントリスナー
  submitReservationBtn.addEventListener('click', submitReservation);
}

// -------------------------------------------
// 動的に生成された質問項目からデータを収集するヘルパー関数
// -------------------------------------------
function getDynamicQuestionsData() {
    const data = {};
    const dynamicQuestionsContainer = document.getElementById('dynamic-questions-container');
    if (dynamicQuestionsContainer) {
        dynamicQuestions.forEach(question => {
            const inputElement = document.getElementById(question.question_key);
            if (!inputElement) {
                // console.warn(`動的質問項目 ${question.question_key} の要素が見つかりません。`);
                return;
            }

            let value;
            if (question.input_type === 'checkbox') {
                const checkboxes = document.querySelectorAll(`input[name="${question.question_key}"]:checked`);
                value = Array.from(checkboxes).map(cb => cb.value);
            } else if (question.input_type === 'radio') {
                const radio = document.querySelector(`input[name="${question.question_key}"]:checked`);
                value = radio ? radio.value : '';
            } else {
                value = inputElement.value.trim();
            }
            data[question.question_key] = value;
        });
    }
    return data;
}

// -------------------------------------------
// バリデーション関数
// -------------------------------------------
function validateReservation() {
    const dynamicQuestionsData = getDynamicQuestionsData(); // 動的質問データを取得

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
  const dynamicQuestionsData = getDynamicQuestionsData();

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