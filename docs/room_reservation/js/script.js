const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyZEeRJFzVSya4TBN4mddhIMBb6_k-6B_FFLDEcFf_YFZRp1MM8fHr-12otS42DDd65/exec';
const API_ENDPOINT = 'https://momoport.hirayu.jp/php/admin_forms.php'; // admin_forms.php へのパス

// 予約確認モーダル関連の要素
const reservationConfirmModal = document.getElementById('order-confirm-modal'); // IDはHTML側で変更済み
const reservationDetailsEl = document.getElementById('reservation-details');
const totalPriceDetailEl = document.getElementById('total-price-detail'); // 料金が発生する場合に利用
const messageEl = document.getElementById('message');

// フォーム要素
const reservationForm = document.getElementById('reservationForm');
const reservationDateInput = document.getElementById('reservationDate');
const numberOfWeeksInput = document.getElementById('numberOfWeeks');
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
    const response = await fetch(`${API_ENDPOINT}?form_name=room_reservation_form`);
    const data = await response.json();

    if (data.status === 'success' && data.questions) {
      const dynamicQuestionsContainer = document.createElement('div');
      dynamicQuestionsContainer.id = 'dynamic-questions-container';
      // 既存のフォーム要素の後に動的な質問を追加する
      // reservationForm の直前に追加する方が自然かもしれない
      const existingFormGroups = reservationForm.querySelectorAll('.form-group');
      if (existingFormGroups.length > 0) {
        existingFormGroups[existingFormGroups.length - 1].after(dynamicQuestionsContainer);
      } else {
        reservationForm.prepend(dynamicQuestionsContainer);
      }

      data.questions.sort((a, b) => a.order_num - b.order_num).forEach(question => {
        const questionGroup = document.createElement('div');
        questionGroup.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = question.question_text;
        if (question.is_required) {
          label.innerHTML += ' <span class="required">*</span>';
        }
        questionGroup.appendChild(label);

        let inputElement;
        switch (question.input_type) {
          case 'text':
          case 'number':
            inputElement = document.createElement('input');
            inputElement.type = question.input_type;
            inputElement.name = question.question_key;
            inputElement.id = question.question_key;
            if (question.is_required) inputElement.required = true;
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
function initializeReservationForm() {
  const now = new Date();
  let searchStartDate = new Date(now);
  let message = '';

  // 17時を過ぎていたら、検索開始日を翌日にする
  if (now.getHours() >= 17) {
    searchStartDate.setDate(now.getDate() + 1);
    message = '※現在時刻が17時を過ぎているため、最短予約日は翌々日以降となります。\n';
  }

  // 最短予約可能日を設定 (翌日)
  const tomorrow = new Date(searchStartDate);
  tomorrow.setDate(searchStartDate.getDate() + 1);

  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0'); // 月は0から始まるため+1
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  reservationDateInput.value = `${yyyy}-${mm}-${dd}`;

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

  // 開始時刻と終了時刻の初期値を設定 (例: 09:00 - 10:00)
  startTimeInput.value = '09:00';
  endTimeInput.value = '10:00';

  // 動的な質問を読み込む
  loadDynamicQuestions();

  // 予約確認ボタンのイベントリスナー
  confirmReservationBtn.addEventListener('click', openReservationConfirmModal);
  // 予約確定ボタンのイベントリスナー
  submitReservationBtn.addEventListener('click', submitReservation);
}

// -------------------------------------------
// バリデーション関数
// -------------------------------------------
function validateReservation() {
    const initialReservationDate = new Date(reservationDateInput.value);
    const numberOfWeeks = parseInt(numberOfWeeksInput.value);

    if (isNaN(numberOfWeeks) || numberOfWeeks < 1) {
        openResultModal('入力エラー', '連続予約週数は1以上の数値を入力してください。');
        return false;
    }

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

        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        if (!startTime || !endTime) {
            openResultModal('入力エラー', '開始時刻と終了時刻を選択してください。');
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

  // フォームデータを取得
  const startTime = startTimeInput.value;
  const endTime = endTimeInput.value;
  const purpose = "​" + purposeInput.value;
  const participants = participantsInput.value;
  const contactName = "​" + contactNameInput.value;
  const contactEmail = contactEmailInput.value;
  const contactPhone = "​" + contactPhoneInput.value;
  const selectedEquipment = Array.from(equipmentSelect.selectedOptions).map(option => option.textContent);
  const notes = "​" + notesInput.value;

  // 動的に生成された質問のデータを取得
  const dynamicQuestionsData = {};
  const dynamicQuestionsContainer = document.getElementById('dynamic-questions-container');
  if (dynamicQuestionsContainer) {
    dynamicQuestionsContainer.querySelectorAll('input, select, textarea').forEach(input => {
      if (input.name) {
        if (input.type === 'checkbox') {
          if (!dynamicQuestionsData[input.name]) {
            dynamicQuestionsData[input.name] = [];
          }
          if (input.checked) {
            dynamicQuestionsData[input.name].push(input.value);
          }
        } else if (input.type === 'radio') {
          if (input.checked) {
            dynamicQuestionsData[input.name] = input.value;
          }
        } else {
          dynamicQuestionsData[input.name] = input.value;
        }
      }
    });
  }

  // 予約情報をオブジェクトにまとめる
  currentReservation = {
    reservationDates: allReservationDates, // 連続予約の日付配列
    startTime,
    endTime,
    purpose,
    participants,
    contactName,
    contactEmail,
    contactPhone,
    equipment: selectedEquipment,
    notes,
    dynamicQuestions: dynamicQuestionsData // 動的な質問データを追加
  };

  // モーダルに表示する内容を生成
  let detailsHtml = `
    <p><strong>利用日:</strong> ${allReservationDates.join(', ')}</p>
    <p><strong>利用時間:</strong> ${startTime} - ${endTime}</p>
    <p><strong>利用目的:</strong> ${purpose}</p>
    <p><strong>参加人数:</strong> ${participants}名</p>
    <p><strong>代表者名:</strong> ${contactName}</p>
    <p><strong>メールアドレス:</strong> ${contactEmail}</p>
    <p><strong>電話番号:</strong> ${contactPhone || 'なし'}</p>
    <p><strong>利用備品:</strong> ${selectedEquipment.length > 0 ? selectedEquipment.join(', ') : 'なし'}</p>
    <p><strong>特記事項:</strong> ${notes || 'なし'}</p>
  `;

  // 動的な質問の詳細をHTMLに追加
  for (const key in dynamicQuestionsData) {
    if (dynamicQuestionsData.hasOwnProperty(key)) {
      // 質問キーに対応するラベルテキストを探す（またはキーをそのまま使用）
      const questionLabelElement = document.querySelector(`#dynamic-questions-container [name="${key}"]`)?.closest('.form-group')?.querySelector('label');
      let questionLabel = key; // デフォルトはキー名
      if (questionLabelElement) {
        // ラベルテキストから必須マーク（*）を削除
        questionLabel = questionLabelElement.textContent.replace(/\s*\*(\s*|$)/, '');
      }

      let value = dynamicQuestionsData[key];
      if (Array.isArray(value)) {
        value = value.join(', ');
      }
      detailsHtml += `<p><strong>${questionLabel}:</strong> ${value || 'なし'}</p>`;
    }
  }

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
    const contactNameInput = document.getElementById('contactName');
    if (contactNameInput && !contactNameInput.value) { // 既に値がなければ自動入力
        contactNameInput.value = decodeURIComponent(lineNameFromUrl);
    }
    // URLからlineNameパラメータを削除（URLをクリーンにするため）
    const newUrl = window.location.origin + window.location.pathname + window.location.search.replace(/&?lineName=[^&]*/, '');
    window.history.replaceState({}, document.title, newUrl);
}

window.onload = initializeReservationForm;