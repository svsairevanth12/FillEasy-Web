class FormBuilder {
	constructor() {
		this.questions = [];
		this.formId = null;
		this.shareId = null;
		this.token = localStorage.getItem('token');
		this.init();
	}

	getAuthHeaders() {
		return {
			'Authorization': `Bearer ${this.token}`,
			'Content-Type': 'application/json'
		};
	}

	init() {
		this.addQuestionBtn = document.getElementById('add-question-btn');
		this.questionsContainer = document.querySelector('.questions-container');
		this.questionTypesMenu = document.querySelector('.question-types-menu');
		this.previewBtn = document.getElementById('preview-btn');
		this.saveBtn = document.getElementById('save-btn');

		// Add speech recognition to title and description
		const titleInput = document.querySelector('.form-title');
		const descriptionInput = document.querySelector('.form-description');
		
		window.speechRecognition.addSpeechButton(
			titleInput,
			titleInput.parentElement
		);
		
		window.speechRecognition.addSpeechButton(
			descriptionInput,
			descriptionInput.parentElement
		);

		// Check if we're editing an existing form
		const urlParams = new URLSearchParams(window.location.search);
		const editFormId = urlParams.get('edit');
		
		if (editFormId) {
			this.loadExistingForm(editFormId);
		}

		this.bindEvents();
	}

	async loadExistingForm(formId) {
		try {
			const response = await fetch(`http://localhost:3001/api/forms/${formId}`, {
				headers: this.getAuthHeaders()
			});
			if (!response.ok) {
				if (response.status === 401) {
					window.location.href = '/login';
					return;
				}
				throw new Error('Failed to load form');
			}
			const formData = await response.json();
			
			this.formId = formId;
			this.shareId = formData.share_id;
			document.querySelector('.form-title').value = formData.title || '';
			document.querySelector('.form-description').value = formData.description || '';
			
			// Load questions
			formData.questions.forEach(q => {
				this.questions.push(q);
				const questionHTML = this.createQuestionHTML(q.type, q.id);
				const questionWrapper = document.createElement('div');
				questionWrapper.className = 'question-card';
				questionWrapper.innerHTML = questionHTML;
				
				// Add speech recognition to question
				const questionInput = questionWrapper.querySelector('.question-input');
				const inputWrapper = questionWrapper.querySelector('.question-input-wrapper');
				window.speechRecognition.addSpeechButton(questionInput, inputWrapper);

				// Set question text and required status
				questionInput.value = q.question;
				questionWrapper.querySelector('.required-checkbox').checked = q.required;

				// Set options for multiple choice, checkbox, or dropdown questions
				if (q.options && q.options.length > 0) {
					const optionsContainer = questionWrapper.querySelector('.question-options');
					q.options.forEach((option, index) => {
						if (index === 0) {
							const firstOptionInput = optionsContainer.querySelector('.option-input');
							if (firstOptionInput) {
								firstOptionInput.value = option;
								window.speechRecognition.addSpeechButton(
									firstOptionInput,
									firstOptionInput.parentElement
								);
							}
						} else {
							this.addOption(optionsContainer, q.type, option);
						}
					});
				}

				this.questionsContainer.appendChild(questionWrapper);
			});
		} catch (error) {
			console.error('Error loading form:', error);
			alert('Failed to load form');
		}
	}


	bindEvents() {
		this.addQuestionBtn.addEventListener('click', (e) => this.showQuestionTypesMenu(e));
		document.addEventListener('click', (e) => this.handleDocumentClick(e));
		this.questionTypesMenu.addEventListener('click', (e) => this.handleQuestionTypeSelection(e));
		this.previewBtn.addEventListener('click', () => this.previewForm());
		this.saveBtn.addEventListener('click', () => this.saveForm());
		
		// Event delegation for dynamic elements
		this.questionsContainer.addEventListener('click', (e) => this.handleQuestionActions(e));
		this.questionsContainer.addEventListener('input', (e) => this.handleQuestionInput(e));
	}

	showQuestionTypesMenu(event) {
		const rect = event.target.getBoundingClientRect();
		this.questionTypesMenu.style.display = 'block';
		this.questionTypesMenu.style.top = `${rect.bottom + window.scrollY + 5}px`;
		this.questionTypesMenu.style.left = `${rect.left}px`;
	}

	handleDocumentClick(event) {
		if (!event.target.closest('#add-question-btn') && 
			!event.target.closest('.question-types-menu')) {
			this.questionTypesMenu.style.display = 'none';
		}
	}

	handleQuestionTypeSelection(event) {
		const menuItem = event.target.closest('.menu-item');
		if (!menuItem) return;

		const type = menuItem.dataset.type;
		this.addQuestion(type);
		this.questionTypesMenu.style.display = 'none';
	}

	addQuestion(type) {
		const questionId = `question-${Date.now()}`;
		const questionHTML = this.createQuestionHTML(type, questionId);
		
		const questionWrapper = document.createElement('div');
		questionWrapper.className = 'question-card';
		questionWrapper.innerHTML = questionHTML;
		
		// Add speech recognition to question input
		const questionInput = questionWrapper.querySelector('.question-input');
		const inputWrapper = questionWrapper.querySelector('.question-input-wrapper');
		window.speechRecognition.addSpeechButton(questionInput, inputWrapper);

		this.questionsContainer.appendChild(questionWrapper);
		
		// Add speech recognition to options if applicable
		if (type === 'multiple' || type === 'checkbox' || type === 'dropdown') {
			const firstOptionInput = questionWrapper.querySelector('.option-input');
			if (firstOptionInput) {
				window.speechRecognition.addSpeechButton(
					firstOptionInput,
					firstOptionInput.parentElement
				);
			}
		}

		this.questions.push({
			id: questionId,
			type: type,
			question: '',
			required: false,
			options: type === 'multiple' || type === 'checkbox' ? ['Option 1'] : []
		});
	}

	createQuestionHTML(type, id) {
		const baseHTML = `
			<button class="delete-question" data-id="${id}">
				<i class="fas fa-trash"></i>
			</button>
			<div class="question-input-wrapper">
				<input type="text" class="question-input" placeholder="Question" data-id="${id}">
			</div>
			<div class="question-options" data-id="${id}">
				${this.getOptionsHTML(type)}
			</div>
			<div class="required-toggle">
				<label>
					Required
					<input type="checkbox" class="required-checkbox" data-id="${id}">
				</label>
			</div>
		`;
		return baseHTML;
	}

	getOptionsHTML(type) {
		switch(type) {
			case 'short':
				return '<input type="text" disabled placeholder="Short answer text" class="answer-input">';
			case 'paragraph':
				return '<textarea disabled placeholder="Long answer text" class="answer-input"></textarea>';
			case 'multiple':
				return `
					<div class="option-item">
						<input type="radio" disabled>
						<input type="text" placeholder="Option 1" class="option-input">
					</div>
					<button class="add-option-btn" data-type="multiple">Add Option</button>
				`;
			case 'checkbox':
				return `
					<div class="option-item">
						<input type="checkbox" disabled>
						<input type="text" placeholder="Option 1" class="option-input">
					</div>
					<button class="add-option-btn" data-type="checkbox">Add Option</button>
				`;
			case 'dropdown':
				return `
					<select disabled>
						<option>Option 1</option>
					</select>
					<div class="option-item">
						<input type="text" placeholder="Option 1" class="option-input">
					</div>
					<button class="add-option-btn" data-type="dropdown">Add Option</button>
				`;
			default:
				return '';
		}
	}

	handleQuestionActions(event) {
		if (event.target.closest('.delete-question')) {
			const id = event.target.closest('.delete-question').dataset.id;
			this.deleteQuestion(id);
		} else if (event.target.closest('.add-option-btn')) {
			const questionCard = event.target.closest('.question-card');
			const optionsContainer = questionCard.querySelector('.question-options');
			const type = event.target.dataset.type;
			this.addOption(optionsContainer, type);
		}
	}

	deleteQuestion(id) {
		const questionCard = document.querySelector(`.question-card:has([data-id="${id}"])`);
		if (questionCard) {
			questionCard.remove();
			this.questions = this.questions.filter(q => q.id !== id);
		}
	}

	addOption(container, type) {
		const optionItem = document.createElement('div');
		optionItem.className = 'option-item';
		
		const input = type === 'multiple' ? 'radio' : 'checkbox';
		optionItem.innerHTML = `
			<input type="${input}" disabled>
			<input type="text" placeholder="Option" class="option-input">
		`;
		
		// Add speech recognition to new option
		const optionInput = optionItem.querySelector('.option-input');
		window.speechRecognition.addSpeechButton(optionInput, optionItem);
		
		container.insertBefore(optionItem, container.lastElementChild);
	}

	handleQuestionInput(event) {
		// We don't update this.questions array on input anymore
		// The data will be collected when save is clicked
	}

	previewForm() {
		// Collect all form data at preview time
		const formData = {
			title: document.querySelector('.form-title').value,
			description: document.querySelector('.form-description').value,
			questions: Array.from(document.querySelectorAll('.question-card')).map(card => {
				const id = card.querySelector('.question-input').dataset.id;
				const question = {
					id: id,
					type: this.questions.find(q => q.id === id).type,
					question: card.querySelector('.question-input').value,
					required: card.querySelector('.required-checkbox').checked
				};

				// Handle options for multiple choice, checkbox, or dropdown questions
				const optionsContainer = card.querySelector('.question-options');
				if (optionsContainer) {
					const optionInputs = optionsContainer.querySelectorAll('.option-input');
					if (optionInputs.length > 0) {
						question.options = Array.from(optionInputs).map(input => input.value);
					}
				}

				return question;
			})
		};
		
		// Store in localStorage for preview
		localStorage.setItem('formPreview', JSON.stringify(formData));
		
		// Open preview in new window
		window.open('preview.html', '_blank');
	}

	async saveForm() {
		try {
			const title = document.querySelector('.form-title').value;
			const description = document.querySelector('.form-description').value;

			// Update questions data
			document.querySelectorAll('.question-card').forEach((card, index) => {
				const id = card.querySelector('.question-input').dataset.id;
				const question = this.questions.find(q => q.id === id);
				if (question) {
					question.question = card.querySelector('.question-input').value;
					question.required = card.querySelector('.required-checkbox').checked;
					
					if (['multiple', 'checkbox', 'dropdown'].includes(question.type)) {
						question.options = Array.from(card.querySelectorAll('.option-input'))
							.map(input => input.value.trim())
							.filter(value => value !== '');
					}
				}
			});

			const formData = {
				title,
				description,
				questions: this.questions
			};

			const url = this.formId 
				? `http://localhost:3001/api/forms/${this.formId}`
				: 'http://localhost:3001/api/forms';

			const response = await fetch(url, {
				method: this.formId ? 'PUT' : 'POST',
				headers: this.getAuthHeaders(),
				body: JSON.stringify(formData)
			});

			if (!response.ok) {
				if (response.status === 401) {
					window.location.href = '/login';
					return;
				}
				throw new Error('Failed to save form');
			}

			const result = await response.json();
			if (result.success) {
				window.location.href = 'forms';
			} else {
				throw new Error(result.error || 'Failed to save form');
			}
		} catch (error) {
			console.error('Error saving form:', error);
			alert('Failed to save form: ' + error.message);
		}
	}

	showShareDialog() {
		const shareUrl = `http://localhost:3001/share/shared-form.html?id=${this.shareId}`;
		const dialog = document.createElement('div');
		dialog.className = 'share-dialog';
		dialog.innerHTML = `
			<div class="share-content">
				<h3>Form Saved Successfully!</h3>
				<p>Share this form with others:</p>
				<div class="share-url-container">
					<input type="text" readonly value="${shareUrl}" class="share-url">
					<button class="copy-btn">Copy</button>
				</div>
				<div class="dialog-actions">
					<button class="close-btn">Close</button>
				</div>
			</div>
		`;

		document.body.appendChild(dialog);

		const copyBtn = dialog.querySelector('.copy-btn');
		const closeBtn = dialog.querySelector('.close-btn');
		const urlInput = dialog.querySelector('.share-url');

		copyBtn.addEventListener('click', () => {
			urlInput.select();
			document.execCommand('copy');
			copyBtn.textContent = 'Copied!';
			setTimeout(() => {
				copyBtn.textContent = 'Copy';
			}, 2000);
		});

		closeBtn.addEventListener('click', () => {
			dialog.remove();
			window.location.href = 'forms';
		});

		dialog.addEventListener('click', (e) => {
			if (e.target === dialog) {
				dialog.remove();
				window.location.href = 'forms';
			}
		});
	}

	escapeHtml(unsafe) {
		return unsafe
			.toString()
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}

// Initialize the form builder
const formBuilder = new FormBuilder();