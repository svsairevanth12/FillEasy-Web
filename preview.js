class FormPreview {
	constructor() {
		this.formData = null;
		this.init();
	}

	init() {
		this.loadFormData();
		if (this.formData) {
			this.renderForm();
			this.bindEvents();
		}
	}

	loadFormData() {
		try {
			const formDataString = localStorage.getItem('formPreview');
			if (!formDataString) {
				throw new Error('No form data found');
			}
			this.formData = JSON.parse(formDataString);
			if (!this.formData.questions || !Array.isArray(this.formData.questions)) {
				throw new Error('Invalid form data structure');
			}
		} catch (e) {
			this.showError(e.message || 'Error loading form data');
			return false;
		}
		return true;
	}

	renderForm() {
		// Set title and description
		document.querySelector('.form-title').textContent = this.formData.title || 'Untitled Form';
		document.querySelector('.form-description').textContent = this.formData.description || '';

		// Clear existing questions
		const container = document.querySelector('.questions-container');
		container.innerHTML = '';

		// Render questions
		this.formData.questions.forEach((question, index) => {
			if (question && question.type) {
				const questionElement = this.createQuestionElement(question, index);
				container.appendChild(questionElement);

				// Add speech recognition to text inputs
				if (question.type === 'short' || question.type === 'paragraph') {
					const input = questionElement.querySelector('.answer-input');
					const wrapper = questionElement.querySelector('.input-wrapper');
					if (input && wrapper) {
						window.speechRecognition.addSpeechButton(input, wrapper);
					}
				}
			}
		});
	}

	createQuestionElement(question, index) {
		const div = document.createElement('div');
		div.className = 'question-card';
		div.dataset.questionId = question.id;

		const titleHtml = `
			<div class="question-title">
				${this.escapeHtml(question.question || `Question ${index + 1}`)}
				${question.required ? '<span class="required-marker">*</span>' : ''}
			</div>
		`;

		const answerHtml = this.createAnswerHTML(question);
		const errorHtml = '<div class="error-message">This is a required question</div>';

		div.innerHTML = titleHtml + answerHtml + errorHtml;
		return div;
	}

	createAnswerHTML(question) {
		if (!question.type) return '';

		switch (question.type) {
			case 'short':
				return `
					<div class="input-wrapper">
						<input type="text" class="answer-input" ${question.required ? 'required' : ''}>
					</div>`;
			
			case 'paragraph':
				return `
					<div class="input-wrapper">
						<textarea class="answer-input" ${question.required ? 'required' : ''}></textarea>
					</div>`;
			
			case 'multiple':
				return this.createOptionsHTML(question, 'radio');
			
			case 'checkbox':
				return this.createOptionsHTML(question, 'checkbox');
			
			case 'dropdown':
				return this.createDropdownHTML(question);
			
			default:
				return '';
		}
	}

	createOptionsHTML(question, type) {
		const name = `question-${question.id}`;
		const options = Array.isArray(question.options) ? question.options : [];
		
		return `
			<div class="options-container">
				${options.map((option, index) => `
					<div class="${type}-option">
						<input type="${type}" 
							   name="${name}" 
							   id="${name}-${index}"
							   value="${this.escapeHtml(option)}"
							   ${question.required && type === 'radio' ? 'required' : ''}>
						<label for="${name}-${index}">${this.escapeHtml(option)}</label>
					</div>
				`).join('')}
			</div>
		`;
	}

	createDropdownHTML(question) {
		const name = `question-${question.id}`;
		const options = Array.isArray(question.options) ? question.options : [];
		
		return `
			<select class="answer-input" name="${name}" ${question.required ? 'required' : ''}>
				<option value="">Choose</option>
				${options.map((option, index) => `
					<option value="${index}">${this.escapeHtml(option)}</option>
				`).join('')}
			</select>
		`;
	}

	escapeHtml(unsafe) {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	bindEvents() {
		const submitBtn = document.getElementById('submit-form');
		if (submitBtn) {
			submitBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.handleSubmit();
			});
		}
	}

	handleSubmit() {
		// Reset previous errors
		document.querySelectorAll('.question-card').forEach(card => {
			card.classList.remove('error');
		});

		// Collect responses
		const responses = [];
		let hasErrors = false;

		this.formData.questions.forEach(question => {
			const card = document.querySelector(`[data-question-id="${question.id}"]`);
			if (!card) return;

			const response = this.getQuestionResponse(question, card);

			if (question.required && !this.isResponseValid(response)) {
				card.classList.add('error');
				hasErrors = true;
			}

			responses.push({
				questionId: question.id,
				question: question.question,
				type: question.type,
				response: response
			});
		});

		if (hasErrors) {
			this.showResponseMessage('Please fill in all required questions.', 'error');
			return;
		}

		// Store responses
		const formResponse = {
			formId: this.formData.id,
			timestamp: new Date().toISOString(),
			responses: responses
		};

		// Get existing responses
		const allResponses = JSON.parse(localStorage.getItem('formResponses') || '[]');
		allResponses.push(formResponse);
		localStorage.setItem('formResponses', JSON.stringify(allResponses));

		this.showResponseMessage('Form submitted successfully!', 'success');
		document.getElementById('submit-form').disabled = true;

		// Clear form preview data
		localStorage.removeItem('formPreview');
	}

	getQuestionResponse(question, card) {
		switch (question.type) {
			case 'short':
			case 'paragraph':
				return card.querySelector('.answer-input').value;
			
			case 'multiple':
				const selectedRadio = card.querySelector('input[type="radio"]:checked');
				return selectedRadio ? selectedRadio.value : '';
			
			case 'checkbox':
				const selectedBoxes = card.querySelectorAll('input[type="checkbox"]:checked');
				return Array.from(selectedBoxes).map(box => box.value);
			
			case 'dropdown':
				const select = card.querySelector('select');
				return select.options[select.selectedIndex].text;
			
			default:
				return '';
		}
	}

	isResponseValid(response) {
		if (Array.isArray(response)) {
			return response.length > 0;
		}
		return response !== '' && response !== 'Choose';
	}

	showResponseMessage(message, type) {
		const messageDiv = document.querySelector('.response-message');
		messageDiv.textContent = message;
		messageDiv.className = `response-message ${type}`;
		messageDiv.style.display = 'block';
		messageDiv.scrollIntoView({ behavior: 'smooth' });
	}


	showError(message) {
		document.querySelector('.preview-container').innerHTML = `
			<div class="response-message error">
				${this.escapeHtml(message)}
			</div>
		`;
	}
}

// Initialize the form preview
const formPreview = new FormPreview();