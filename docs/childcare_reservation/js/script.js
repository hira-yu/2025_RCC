const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyZEeRJFzVSya4TBN4mddhIMBb6_k-6B_FFLDEcFf_YFZRp1MM8fHr-12otS42DDd65/exec';

const API_ENDPOINT = 'https://momoport.hirayu.jp/php/admin_forms.php'; // admin_forms.php へのパス

// -------------------------------------------
// 動的な質問を読み込み、フォームに生成する
// -------------------------------------------
async function loadDynamicQuestions() {
  try {
    const response = await fetch(`${API_ENDPOINT}?form_name=childcare_reservation_form`);
    const data = await response.json();

    if (data.status === 'success' && data.questions) {
      const dynamicQuestionsContainer = document.createElement('div');
      dynamicQuestionsContainer.id = 'dynamic-questions-container';
      // 既存のフォーム要素の後に動的な質問を追加する
      // confirmReservationBtn.parentNode は confirmReservationBtn を囲む div を想定
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
        label.textContent = question.question_text + ":";
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
async function initializeReservationForm() {
  const now = new Date();
  let searchStartDate = new Date(now);
  let message = '';

  // 17時を過ぎていたら、検索開始日を翌日にする
  if (now.getHours() >= 17) {
    searchStartDate.setDate(now.getDate() + 1);
    message = '※現在時刻が17時を過ぎているため、最短予約日は翌日以降となります。\n';
  }

  // 最短予約可能日を設定
  const nextAvailableDate = findNextAvailableWednesday(searchStartDate);
  const yyyy = nextAvailableDate.getFullYear();
  const mm = String(nextAvailableDate.getMonth() + 1).padStart(2, '0');
  const dd = String(nextAvailableDate.getDate()).padStart(2, '0');
  reservationDateInput.value = `${yyyy}-${mm}-${dd}`;

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

  // 利用開始時刻の初期値を設定 (例: 09:30)
  startTimeInput.value = '09:30';

  // 動的な質問を読み込む
  await loadDynamicQuestions();

  // 予約確認ボタンのイベントリスナー
  confirmReservationBtn.addEventListener('click', openReservationConfirmModal);
  // 予約確定ボタンのイベントリスナー
  submitReservationBtn.addEventListener('click', submitReservation);
}

// 予約確認モーダル関連の要素
const reservationConfirmModal = document.getElementById('order-confirm-modal');
const reservationDetailsEl = document.getElementById('reservation-details');
const totalPriceDetailEl = document.getElementById('total-price-detail');
const messageEl = document.getElementById('message');

// フォーム要素
const reservationForm = document.getElementById('reservationForm');
const parentNameInput = document.getElementById('parentName');
const contactPhoneInput = document.getElementById('contactPhone');
const reservationDateInput = document.getElementById('reservationDate');
const usageTimeSelect = document.getElementById('usageTime');
const startTimeInput = document.getElementById('startTime');
const childNameInput = document.getElementById('childName');
const childAgeInput = document.getElementById('childAge');
const childGenderSelect = document.getElementById('childGender');
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
function initializeReservationForm() {
  const now = new Date();
  let searchStartDate = new Date(now);
  let message = '';

  // 17時を過ぎていたら、検索開始日を翌日にする
  if (now.getHours() >= 17) {
    searchStartDate.setDate(now.getDate() + 1);
    message = '※現在時刻が17時を過ぎているため、最短予約日は翌日以降となります。\n';
  }

  // 最短予約可能日を設定
  const nextAvailableDate = findNextAvailableWednesday(searchStartDate);
  const yyyy = nextAvailableDate.getFullYear();
  const mm = String(nextAvailableDate.getMonth() + 1).padStart(2, '0');
  const dd = String(nextAvailableDate.getDate()).padStart(2, '0');
  reservationDateInput.value = `${yyyy}-${mm}-${dd}`;

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

  // 利用開始時刻の初期値を設定 (例: 09:30)
  startTimeInput.value = '09:30';

  // 予約確認ボタンのイベントリスナー
  confirmReservationBtn.addEventListener('click', openReservationConfirmModal);
  // 予約確定ボタンのイベントリスナー
  submitReservationBtn.addEventListener('click', submitReservation);
}

// -------------------------------------------
// バリデーション関数
// -------------------------------------------
function validateReservation() {
    // 今日の日付を取得 (時刻情報は無視)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 予約日を取得 (時刻情報は無視)
    const reservationDate = new Date(reservationDateInput.value);
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

    const startTime = startTimeInput.value;
    const usageTime = parseInt(usageTimeSelect.value);

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

    const childAge = parseInt(childAgeInput.value);
    if (isNaN(childAge) || childAge < 0 || childAge > 15) {
        openResultModal('入力エラー', 'お子様の年齢は0歳から15歳までで入力してください。');
        return false;
    }

    if (!childGenderSelect.value) {
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

  // フォームデータを取得
  const parentName = parentNameInput.value;
  const contactPhone = contactPhoneInput.value;
  const reservationDate = reservationDateInput.value;
  const usageTime = parseInt(usageTimeSelect.value);
  const startTime = startTimeInput.value;
  const childName = childNameInput.value;
  const childAge = childAgeInput.value;
  const childGender = childGenderSelect.value;
  const notes = notesInput.value;

  const totalPrice = calculatePrice(usageTime);

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
    parentName,
    contactPhone,
    reservationDate,
    usageTime,
    startTime,
    childName,
    childAge,
    childGender,
    notes,
    totalPrice,
    dynamicQuestions: dynamicQuestionsData // 動的な質問データを追加
  };

  // モーダルに表示する内容を生成
  let detailsHtml = `
    <p><strong>保護者名:</strong> ${parentName}</p>
    <p><strong>連絡先携帯番号:</strong> ${contactPhone}</p>
    <p><strong>利用日:</strong> ${reservationDate}</p>
    <p><strong>利用時間:</strong> ${usageTime}時間</p>
    <p><strong>利用開始時刻:</strong> ${startTime}</p>
    <p><strong>お子様の名前:</strong> ${childName}</p>
    <p><strong>お子様の年齢:</strong> ${childAge}歳</p>
    <p><strong>お子様の性別:</strong> ${childGender === 'male' ? '男' : childGender === 'female' ? '女' : 'その他'}</p>
    <p><strong>その他お問い合わせ:</strong> ${notes || 'なし'}</p>
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
    const parentNameInput = document.getElementById('parentName');
    if (parentNameInput && !parentNameInput.value) { // 既に値がなければ自動入力
        parentNameInput.value = decodeURIComponent(lineNameFromUrl);
    }
    // URLからlineNameパラメータを削除（URLをクリーンにするため）
    const newUrl = window.location.origin + window.location.pathname + window.location.search.replace(/&?lineName=[^&]*/, '');
    window.history.replaceState({}, document.title, newUrl);
}

window.onload = initializeReservationForm;