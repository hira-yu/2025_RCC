class MultiSelectDropdown {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            placeholder: 'Select Options',
            txtSelected: 'Selected',
            txtAll: 'All',
            txtRemove: 'Remove',
            txtSearch: 'Search',
            ...options
        };
        this.selectedOptions = [];
        this.dropdown = null;
        this.init();
    }

    init() {
        this.element.style.display = 'none';
        this.createDropdown();
        this.attachEvents();
        this.updateSelectedDisplay();
    }

    createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'multi-select-dropdown';
        this.element.parentNode.insertBefore(this.dropdown, this.element.nextSibling);

        this.createSelectedDisplay();
        this.createDropdownContainer();
    }

    createSelectedDisplay() {
        const selectedDisplay = document.createElement('div');
        selectedDisplay.className = 'selected-display';
        selectedDisplay.textContent = this.options.placeholder;
        this.dropdown.appendChild(selectedDisplay);

        this.selectedDisplay = selectedDisplay;
    }

    createDropdownContainer() {
        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'dropdown-container';
        dropdownContainer.style.display = 'none';

        this.createSearchInput(dropdownContainer);
        this.createOptionsContainer(dropdownContainer);
        this.createSelectAll(dropdownContainer);

        this.dropdown.appendChild(dropdownContainer);
        this.dropdownContainer = dropdownContainer;
    }

    createSearchInput(container) {
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-input';
        searchInput.placeholder = this.options.txtSearch;
        container.appendChild(searchInput);

        this.searchInput = searchInput;
    }

    createOptionsContainer(container) {
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'options';
        container.appendChild(optionsContainer);

        this.optionsContainer = optionsContainer;
        this.populateOptions();
    }

    populateOptions() {
        this.optionsContainer.innerHTML = '';
        Array.from(this.element.options).forEach(option => {
            this.createOptionElement(option);
        });
    }

    createOptionElement(option) {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.dataset.value = option.value;
        optionElement.dataset.display = option.textContent;

        const checkbox = document.createElement('span');
        checkbox.className = 'checkbox';
        optionElement.appendChild(checkbox);

        const text = document.createElement('span');
        text.textContent = option.textContent;
        optionElement.appendChild(text);

        if (option.selected) {
            optionElement.classList.add('selected');
            this.selectedOptions.push(option.value);
        }

        this.optionsContainer.appendChild(optionElement);
    }

    createSelectAll(container) {
        const selectAll = document.createElement('div');
        selectAll.className = 'select-all';
        selectAll.textContent = this.options.txtAll;
        container.appendChild(selectAll);

        this.selectAll = selectAll;
    }

    attachEvents() {
        this.selectedDisplay.addEventListener('click', () => {
            this.toggleDropdown();
        });

        this.searchInput.addEventListener('input', () => {
            this.filterOptions();
        });

        this.optionsContainer.addEventListener('click', (e) => {
            const optionElement = e.target.closest('.option');
            if (optionElement) {
                this.toggleOption(optionElement);
            }
        });

        this.selectAll.addEventListener('click', () => {
            this.toggleSelectAll();
        });

        document.addEventListener('click', (e) => {
            if (!this.dropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    toggleDropdown() {
        this.dropdownContainer.style.display = this.dropdownContainer.style.display === 'none' ? 'block' : 'none';
        if (this.dropdownContainer.style.display === 'block') {
            this.searchInput.focus();
        }
    }

    hideDropdown() {
        this.dropdownContainer.style.display = 'none';
    }

    filterOptions() {
        const searchTerm = this.searchInput.value.toLowerCase();
        Array.from(this.optionsContainer.children).forEach(optionElement => {
            const display = optionElement.dataset.display.toLowerCase();
            if (display.includes(searchTerm)) {
                optionElement.classList.remove('hidden');
            } else {
                optionElement.classList.add('hidden');
            }
        });
    }

    toggleOption(optionElement) {
        const value = optionElement.dataset.value;
        const index = this.selectedOptions.indexOf(value);

        if (index > -1) {
            this.selectedOptions.splice(index, 1);
            optionElement.classList.remove('selected');
        } else {
            this.selectedOptions.push(value);
            optionElement.classList.add('selected');
        }
        this.updateSelectedDisplay();
        this.updateNativeSelect();
    }

    toggleSelectAll() {
        const allOptions = Array.from(this.element.options).map(option => option.value);
        if (this.selectedOptions.length === allOptions.length) {
            this.selectedOptions = [];
            Array.from(this.optionsContainer.children).forEach(optionElement => {
                optionElement.classList.remove('selected');
            });
        } else {
            this.selectedOptions = [...allOptions];
            Array.from(this.optionsContainer.children).forEach(optionElement => {
                optionElement.classList.add('selected');
            });
        }
        this.updateSelectedDisplay();
        this.updateNativeSelect();
    }

    updateSelectedDisplay() {
        if (this.selectedOptions.length === 0) {
            this.selectedDisplay.textContent = this.options.placeholder;
        } else {
            const selectedText = this.selectedOptions.map(value => {
                const option = Array.from(this.element.options).find(opt => opt.value === value);
                return option ? option.textContent : '';
            });
            this.selectedDisplay.innerHTML = selectedText.map(value => {
                const option = Array.from(this.element.options).find(opt => opt.textContent === value);
                return option ? `<span class="item" data-value="${option.value}">${value}<span class="remove">&times;</span></span>` : '';
            }).join('');
            this.selectedDisplay.querySelectorAll('.item .remove').forEach(removeBtn => {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent dropdown from toggling
                    const itemValue = removeBtn.parentNode.dataset.value;
                    this.removeSelectedOption(itemValue);
                });
            });
        }
    }

    removeSelectedOption(value) {
        const index = this.selectedOptions.indexOf(value);
        if (index > -1) {
            this.selectedOptions.splice(index, 1);
            const optionElement = this.optionsContainer.querySelector(`[data-value="${value}"]`);
            if (optionElement) {
                optionElement.classList.remove('selected');
            }
            this.updateSelectedDisplay();
            this.updateNativeSelect();
        }
    }

    updateNativeSelect() {
        Array.from(this.element.options).forEach(option => {
            option.selected = this.selectedOptions.includes(option.value);
        });
        this.element.dispatchEvent(new Event('change')); // Trigger change event for native select
    }
}

// Static method to initialize all multi-select dropdowns
MultiSelectDropdown.initAll = (options = {}) => {
    document.querySelectorAll('select[multiple]').forEach(selectElement => {
        new MultiSelectDropdown(selectElement, options);
    });
};

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    MultiSelectDropdown.initAll();
});
