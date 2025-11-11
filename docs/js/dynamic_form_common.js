const COMMON_API_ENDPOINT = 'https://momoport.hirayu.jp/php/get_form_questions.php';

/**
 * 動的な質問をAPIから読み込む
 * @param {string} formName - フォームの名前 (例: 'room_reservation')
 * @returns {Promise<Array>} 質問データの配列
 */
export async function loadDynamicQuestionsCommon(formName) {
  try {
    const response = await fetch(`${COMMON_API_ENDPOINT}?form_name=${formName}`);
    const data = await response.json();

    if (data.status === 'success' && data.questions) {
      return data.questions;
    } else {
      console.error(`Failed to load dynamic questions for ${formName}:`, data.message);
      return [];
    }
  } catch (error) {
    console.error(`Error loading dynamic questions for ${formName}:`, error);
    return [];
  }
}

/**
 * 取得した質問データを元にフォーム要素を動的にレンダリングする
 * @param {Array} questions - 質問データの配列
 * @param {string} containerId - フォーム要素を挿入するコンテナのID
 * @param {string} formName - フォームの名前 (ページ固有のロジック分岐に使用)
 */
export function renderDynamicQuestionsCommon(questions, containerId, formName, initialValues = {}) {
  const dynamicQuestionsContainer = document.getElementById(containerId);
  if (!dynamicQuestionsContainer) {
    console.error(`Dynamic questions container with ID "${containerId}" not found.`);
    return;
  }
  dynamicQuestionsContainer.innerHTML = ''; // 既存の内容をクリア

  questions.sort((a, b) => a.order_num - b.order_num).forEach(question => {
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
      case 'email':
      case 'tel':
      case 'date':
      case 'time':
      case 'password':
      case 'range':
      case 'datetime-local':
      case 'month':
      case 'week':
      case 'color':
      case 'file':
      case 'search':
      case 'url':
        inputElement = document.createElement('input');
        inputElement.type = question.input_type;
        inputElement.name = question.question_key;
        inputElement.id = question.question_key;
        if (question.is_required) inputElement.required = true;
        if (initialValues[question.question_key] !== undefined) {
          inputElement.value = initialValues[question.question_key];
        }

        // ページ固有の属性設定
        if (formName === 'room_reservation') {
            if (question.input_type === 'time') {
                inputElement.step = '1800'; // 30分単位
            }
            if (question.question_key === 'numberOfWeeks' || question.question_key === 'participants') {
                inputElement.min = '1';
                if (initialValues[question.question_key] === undefined) { // 初期値が指定されていなければデフォルトを設定
                    inputElement.value = '1'; // 初期値
                }
            }
        } else if (formName === 'childcare_reservation') {
            if (question.input_type === 'time') {
                inputElement.step = '900'; // 15分単位
            }
            if (question.question_key === 'childAge') {
                inputElement.min = '0';
                inputElement.max = '15';
            }
        }
        break;
      case 'textarea':
        inputElement = document.createElement('textarea');
        inputElement.name = question.question_key;
        inputElement.id = question.question_key;
        if (question.is_required) inputElement.required = true;
        if (initialValues[question.question_key] !== undefined) {
          inputElement.value = initialValues[question.question_key];
        }
        break;
      case 'select':
        inputElement = document.createElement('select');
        inputElement.name = question.question_key;
        inputElement.id = question.question_key;
        if (question.is_required) inputElement.required = true;
        
        // room_reservation の equipment の select multiple の場合
        if (formName === 'room_reservation' && question.question_key === 'equipment') {
            inputElement.multiple = true;
        }

        // defaultOption は常に作成し、equipment 以外の場合のみ追加
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '選択してください';
        if (!(formName === 'room_reservation' && question.question_key === 'equipment')) {
            inputElement.appendChild(defaultOption);
        }
        
        if (question.options) {
          JSON.parse(question.options).forEach(optionText => {
            const option = document.createElement('option');
            option.value = optionText;
            option.textContent = optionText;
            inputElement.appendChild(option);
          });
        }
        if (initialValues[question.question_key] !== undefined) {
          inputElement.value = initialValues[question.question_key];
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

            // 初期値が設定されているかチェック
            if (initialValues[question.question_key] !== undefined) {
              if (question.input_type === 'radio' && initialValues[question.question_key] === optionText) {
                radioOrCheckbox.checked = true;
              } else if (question.input_type === 'checkbox' && Array.isArray(initialValues[question.question_key]) && initialValues[question.question_key].includes(optionText)) {
                radioOrCheckbox.checked = true;
              }
            }

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

    // equipment の select 要素が生成された後に MultiSelectDropdown を初期化 (room_reservation 固有)
    if (formName === 'room_reservation' && question.question_key === 'equipment' && question.input_type === 'select') {
        // MultiSelectDropdown がグローバルに利用可能であることを前提とする
        if (typeof MultiSelectDropdown !== 'undefined') {
            new MultiSelectDropdown(inputElement);
        } else {
            console.warn('MultiSelectDropdown is not defined. Make sure multi-select-dropdown.js is loaded.');
        }
    }
  });
}

/**
 * 動的に生成された質問項目からデータを収集する
 * @param {Array} questions - 質問データの配列
 * @returns {Object} 収集されたデータ
 */
export function getDynamicQuestionsDataCommon(questions) {
    const data = {};
    questions.forEach(question => {
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
        } else if (inputElement.tagName === 'SELECT' && inputElement.multiple) { // select multiple の場合
            value = Array.from(inputElement.options)
                         .filter(option => option.selected)
                         .map(option => option.value);
        } else {
            value = inputElement.value.trim();
        }
        data[question.question_key] = value;
    });
    return data;
}
