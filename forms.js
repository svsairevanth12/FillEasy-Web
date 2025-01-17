class FormsDashboard {
	constructor() {
		this.forms = [];
		this.token = localStorage.getItem('token');
		this.init();
	}

	getAuthHeaders() {
		return {
			'Authorization': `Bearer ${this.token}`,
			'Content-Type': 'application/json'
		};
	}

	async init() {
		await this.loadForms();
		this.setupEventListeners();
	}

	async loadForms() {
		try {
			this.showLoading();
			const response = await fetch('http://localhost:3001/api/forms', {
				headers: this.getAuthHeaders()
			});
			if (!response.ok) {
				if (response.status === 401) {
					window.location.href = '/login';
					return;
				}
				throw new Error('Failed to load forms');
			}
			this.forms = await response.json();
			this.renderForms();
		} catch (error) {
			console.error('Error loading forms:', error);
			this.showError('Failed to load forms');
		} finally {
			this.hideLoading();
		}
	}

	showLoading() {
		const loading = document.createElement('div');
		loading.className = 'loading-overlay';
		loading.innerHTML = '<div class="loading-spinner"></div>';
		document.body.appendChild(loading);
	}

	hideLoading() {
		const loading = document.querySelector('.loading-overlay');
		if (loading) {
			loading.remove();
		}
	}

	setupEventListeners() {
		document.getElementById('create-new-form').addEventListener('click', () => {
			window.location.href = 'index.html';
		});

		// AI Form Generation
		document.getElementById('generate-form').addEventListener('click', () => {
			this.showGenerateFormModal();
		});

		document.getElementById('generate-form-submit').addEventListener('click', () => {
			this.handleFormGeneration();
		});

		// Modal close handlers
		document.querySelectorAll('.close-modal').forEach(button => {
			button.addEventListener('click', () => {
				document.getElementById('generate-form-modal').style.display = 'none';
				document.getElementById('form-details-modal').style.display = 'none';
				document.body.style.overflow = 'auto';
			});
		});

		// Close modals when clicking outside
		window.addEventListener('click', (event) => {
			const generateModal = document.getElementById('generate-form-modal');
			const formDetailsModal = document.getElementById('form-details-modal');
			if (event.target === generateModal || event.target === formDetailsModal) {
				generateModal.style.display = 'none';
				formDetailsModal.style.display = 'none';
				document.body.style.overflow = 'auto';
			}
		});

		// Add export button handler
		document.getElementById('export-responses').addEventListener('click', () => {
			const formId = document.getElementById('form-details-modal').dataset.currentForm;
			if (formId) {
				this.exportResponses(formId);
			}
		});
	}

	async renderForms() {
		const container = document.getElementById('forms-grid');
		
		if (this.forms.length === 0) {
			container.innerHTML = `
				<div class="no-forms-message">
					<i class="fas fa-file-alt fa-3x"></i>
					<p>No forms created yet. Click "Create New Form" to get started!</p>
				</div>
			`;
			return;
		}

		const formsHTML = await Promise.all(this.forms.map(async form => {
			const responseCount = await this.getResponseCount(form.id);
			return this.createFormCard(form, responseCount);
		}));

		container.innerHTML = formsHTML.join('');

		// Add event listeners to form cards
		container.querySelectorAll('.form-card').forEach(card => {
			const formId = card.dataset.formId;
			
			card.querySelector('.edit-btn').addEventListener('click', () => {
				window.location.href = `index.html?edit=${formId}`;
			});

			card.querySelector('.share-btn').addEventListener('click', () => {
				this.showShareDialog(formId);
			});

			card.querySelector('.view-responses-btn').addEventListener('click', () => {
				this.viewResponses(formId);
			});

			card.querySelector('.delete-btn').addEventListener('click', () => {
				this.deleteForm(formId);
			});
		});
	}

	async getResponseCount(formId) {
		try {
			const response = await fetch(`http://localhost:3001/api/forms/${formId}/response-count`, {
				headers: this.getAuthHeaders()
			});
			if (!response.ok) {
				throw new Error('Failed to get response count');
			}
			const data = await response.json();
			return data.count;
		} catch (error) {
			console.error('Error getting response count:', error);
			return 0;
		}
	}

	createFormCard(form, responseCount) {
		return `
			<div class="form-card" data-form-id="${form.id}">
				<button class="delete-btn" title="Delete form">
					<i class="fas fa-trash"></i>
				</button>
				<h3>${this.escapeHtml(form.title || 'Untitled Form')}</h3>
				<p>${this.escapeHtml(form.description || 'No description')}</p>
				<div class="form-meta">
					<div>Created: ${new Date(form.created_at).toLocaleDateString()}</div>
					<div>
						Responses: ${responseCount}
						<span class="response-count">${responseCount}</span>
					</div>
				</div>
				<div class="form-actions">
					<button class="form-btn edit-btn">
						<i class="fas fa-edit"></i> Edit
					</button>
					<button class="form-btn share-btn">
						<i class="fas fa-share"></i> Share
					</button>
					<button class="form-btn view-responses-btn">
						<i class="fas fa-chart-bar"></i> View Responses
					</button>
				</div>
			</div>
		`;
	}

	showShareDialog(formId) {
		const form = this.forms.find(f => f.id === formId);
		if (!form) return;

		const shareUrl = `http://localhost:3001/share/shared-form.html?id=${form.share_id}`;
		const dialog = document.createElement('div');
		dialog.className = 'share-dialog';
		dialog.innerHTML = `
			<div class="share-content">
				<h3>Share Form</h3>
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

		closeBtn.addEventListener('click', () => dialog.remove());
		dialog.addEventListener('click', (e) => {
			if (e.target === dialog) {
				dialog.remove();
			}
		});
	}

	async viewResponses(formId) {
		try {
			this.showLoading();
			
			// First try to fetch the form
			const formResponse = await fetch(`http://localhost:3001/api/forms/${formId}`, {
				headers: this.getAuthHeaders()
			});
			if (!formResponse.ok) {
				console.error('Form fetch failed:', await formResponse.text());
				throw new Error(`Failed to load form: ${formResponse.status}`);
			}
			const form = await formResponse.json();

			// Then try to fetch the responses
			const responsesResponse = await fetch(`http://localhost:3001/api/forms/${formId}/responses`, {
				headers: this.getAuthHeaders()
			});
			if (!responsesResponse.ok) {
				console.error('Responses fetch failed:', await responsesResponse.text());
				throw new Error(`Failed to load responses: ${responsesResponse.status}`);
			}
			const responses = await responsesResponse.json();

			const modal = document.getElementById('form-details-modal');
			if (!modal) {
				throw new Error('Modal element not found');
			}

			const modalTitle = document.getElementById('modal-title');
			const responsesList = document.getElementById('responses-list');
			const totalResponses = document.getElementById('total-responses');
			const lastResponse = document.getElementById('last-response');

			if (!modalTitle || !responsesList || !totalResponses || !lastResponse) {
				throw new Error('Required modal elements not found');
			}

			modalTitle.textContent = `Responses: ${form.title || 'Untitled Form'}`;
			modal.dataset.currentForm = formId;

			totalResponses.textContent = responses.length;
			lastResponse.textContent = responses.length > 0 
				? new Date(responses[responses.length - 1].created_at).toLocaleString()
				: 'Never';

			responsesList.innerHTML = responses.length > 0 
				? this.createResponsesList(responses)
				: '<div class="no-responses">No responses yet</div>';

			// Ensure modal is visible and positioned correctly
			modal.style.display = 'block';
			document.body.style.overflow = 'hidden'; // Prevent background scrolling
			
		} catch (error) {
			console.error('Error viewing responses:', error);
			this.showError(`Failed to load responses: ${error.message}`);
			this.hideLoading();
		} finally {
			this.hideLoading();
		}
	}

	createResponsesList(responses) {
		console.log('Creating responses list with data:', responses); // Debug log
		
		if (!responses || responses.length === 0) {
			return '<div class="no-responses">No responses yet</div>';
		}

		return responses.map(response => {
			console.log('Processing response:', response); // Debug log
			
			if (!response.response_data || !Array.isArray(response.response_data)) {
				console.error('Invalid response data format:', response);
				return `
					<div class="response-item error">
						<div class="response-timestamp">
							Submitted on ${new Date(response.created_at).toLocaleString()}
						</div>
						<div class="response-content">
							<div class="error-message">Error: Invalid response data format</div>
						</div>
					</div>
				`;
			}

			const responseContent = response.response_data.map(item => {
				if (!item || typeof item !== 'object') {
					console.error('Invalid response item:', item);
					return '';
				}

				return `
					<div class="question-response">
						<div class="question-text">${this.escapeHtml(item.question || '')}</div>
						<div class="response-text">
							${this.formatResponse(item.response)}
						</div>
					</div>
				`;
			}).join('');

			return `
				<div class="response-item">
					<div class="response-timestamp">
						Submitted on ${new Date(response.created_at).toLocaleString()}
					</div>
					<div class="response-content">
						${responseContent}
					</div>
				</div>
			`;
		}).join('');
	}

	formatResponse(response) {
		if (!response) return 'No response';
		
		if (Array.isArray(response)) {
			return response.map(r => this.escapeHtml(r)).join(', ') || 'No response';
		}
		
		return this.escapeHtml(response.toString());
	}

	async deleteForm(formId) {
		if (!confirm('Are you sure you want to delete this form? All responses will be lost.')) {
			return;
		}

		try {
			this.showLoading();
			const response = await fetch(`http://localhost:3001/api/forms/${formId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete form');
			}

			await this.loadForms();
		} catch (error) {
			console.error('Error deleting form:', error);
			this.showError('Failed to delete form');
		} finally {
			this.hideLoading();
		}
	}

	showError(message) {
		const existingError = document.querySelector('.error-message');
		if (existingError) {
			existingError.remove();
		}

		const error = document.createElement('div');
		error.className = 'error-message';
		error.style.position = 'fixed';
		error.style.top = '20px';
		error.style.left = '50%';
		error.style.transform = 'translateX(-50%)';
		error.style.backgroundColor = '#f44336';
		error.style.color = 'white';
		error.style.padding = '1rem';
		error.style.borderRadius = '4px';
		error.style.zIndex = '2000';
		error.textContent = message;
		
		document.body.appendChild(error);
		setTimeout(() => error.remove(), 5000);
	}

	async exportResponses(formId) {
		try {
			this.showLoading();
			const response = await fetch(`http://localhost:3001/api/forms/${formId}/export`);
			
			if (!response.ok) {
				throw new Error('Failed to export responses');
			}

			// Get the filename from the Content-Disposition header if available
			const contentDisposition = response.headers.get('Content-Disposition');
			let filename = 'responses.csv';
			if (contentDisposition) {
				const match = contentDisposition.match(/filename=(.+)/);
				if (match) {
					filename = match[1];
				}
			}

			// Create a blob and download the file
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			a.remove();
		} catch (error) {
			console.error('Error exporting responses:', error);
			this.showError('Failed to export responses');
		} finally {
			this.hideLoading();
		}
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

	showGenerateFormModal() {
		const modal = document.getElementById('generate-form-modal');
		modal.style.display = 'block';
		document.body.style.overflow = 'hidden';
		document.getElementById('form-prompt').value = '';
		document.getElementById('generation-status').style.display = 'none';
	}

	async handleFormGeneration() {
		const prompt = document.getElementById('form-prompt').value.trim();
		if (!prompt) {
			alert('Please enter a description of the form you want to generate');
			return;
		}

		const statusDiv = document.getElementById('generation-status');
		try {
			statusDiv.textContent = 'Generating form...';
			statusDiv.className = 'status-message loading';
			statusDiv.style.display = 'block';

			const response = await fetch('http://localhost:3001/api/forms/generate', {
				method: 'POST',
				headers: this.getAuthHeaders(),
				body: JSON.stringify({ prompt })
			});

			if (!response.ok) {
				if (response.status === 401) {
					window.location.href = '/login';
					return;
				}
				throw new Error('Failed to generate form');
			}

			const result = await response.json();
			if (result.success) {
				statusDiv.textContent = 'Form generated successfully! Redirecting...';
				statusDiv.className = 'status-message success';
				setTimeout(() => {
					window.location.href = 'form-builder?edit=' + result.formId;
				}, 1500);
			} else {
				throw new Error(result.error || 'Failed to generate form');
			}
		} catch (error) {
			console.error('Error generating form:', error);
			statusDiv.textContent = 'Failed to generate form: ' + error.message;
			statusDiv.className = 'status-message error';
		}
	}

	showGenerationStatus(message, type) {
		const statusElement = document.getElementById('generation-status');
		statusElement.className = `status-message ${type}`;
		statusElement.textContent = message;
		statusElement.style.display = 'block';
		
		if (type === 'error') {
			// Scroll status into view for errors
			statusElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}
}

// Initialize the dashboard
const dashboard = new FormsDashboard();