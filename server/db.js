const Database = require('better-sqlite3');
const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');

class DatabaseManager {
	constructor() {
		this.db = new Database('forms.db');
		this.initDatabase();
	}

	initDatabase() {
		// Create tables if they don't exist (removed DROP TABLE statements)
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS users (
				id TEXT PRIMARY KEY,
				email TEXT UNIQUE,
				password TEXT,
				reset_token TEXT,
				reset_token_expiry DATETIME,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS forms (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				title TEXT,
				description TEXT,
				questions TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				share_id TEXT UNIQUE,
				FOREIGN KEY (user_id) REFERENCES users(id)
			);

			CREATE TABLE IF NOT EXISTS responses (
				id TEXT PRIMARY KEY,
				form_id TEXT,
				response_data TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (form_id) REFERENCES forms(id)
			);
		`);

		// Create default admin user if not exists
		const defaultUser = this.getUserByEmail('test@gmail.com');
		if (!defaultUser) {
			this.createUser('test@gmail.com', 'test');
		}
	}

	createUser(email, password) {
		const hashedPassword = bcrypt.hashSync(password, 10);
		const id = nanoid();
		const stmt = this.db.prepare(`
			INSERT INTO users (id, email, password)
			VALUES (?, ?, ?)
		`);
		stmt.run(id, email, hashedPassword);
		return id;
	}

	getUserByEmail(email) {
		const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
		return stmt.get(email);
	}

	validateUser(email, password) {
		const user = this.getUserByEmail(email);
		if (!user) return null;
		try {
			const isValid = bcrypt.compareSync(password, user.password);
			return isValid ? user : null;
		} catch (error) {
			console.error('Error validating user:', error);
			return null;
		}
	}

	setResetToken(email, token) {
		const expiry = new Date();
		expiry.setHours(expiry.getHours() + 1); // Token valid for 1 hour
		const stmt = this.db.prepare(`
			UPDATE users 
			SET reset_token = ?, reset_token_expiry = ?
			WHERE email = ?
		`);
		stmt.run(token, expiry.toISOString(), email);
	}

	validateResetToken(token) {
		const stmt = this.db.prepare(`
			SELECT * FROM users 
			WHERE reset_token = ? AND reset_token_expiry > datetime('now')
		`);
		return stmt.get(token);
	}

	updatePassword(userId, newPassword) {
		const hashedPassword = bcrypt.hashSync(newPassword, 10);
		const stmt = this.db.prepare(`
			UPDATE users 
			SET password = ?, reset_token = NULL, reset_token_expiry = NULL
			WHERE id = ?
		`);
		stmt.run(hashedPassword, userId);
	}

	validateAndCleanQuestions(questions) {
		if (!Array.isArray(questions)) {
			throw new Error('Questions must be an array');
		}

		return questions.map((q, index) => {
			if (!q.type || !q.question) {
				throw new Error(`Invalid question at index ${index}: missing required fields`);
			}

			const cleanedQuestion = {
				id: q.id || `q${index + 1}`,
				type: q.type.toLowerCase(),
				question: q.question.trim(),
				required: Boolean(q.required),
				options: []
			};

			// Handle options for choice-based questions
			if (['multiple', 'checkbox', 'dropdown'].includes(cleanedQuestion.type)) {
				if (!Array.isArray(q.options)) {
					q.options = [];
				}

				// Clean options: remove empty spaces and duplicates
				cleanedQuestion.options = [...new Set(
					q.options
						.map(opt => (opt || '').toString().trim())
						.filter(opt => opt && opt.length > 0)
						.map(opt => opt.replace(/^Option \d+:?\s*/i, ''))
				)];

				// Add default options if none are provided
				if (cleanedQuestion.options.length < 2) {
					cleanedQuestion.options = ['Option 1', 'Option 2'];
				}
			}

			return cleanedQuestion;
		});
	}

	createForm(userId, title, description, questions) {
		try {
			// Verify user exists
			const user = this.db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
			if (!user) {
				throw new Error('User not found');
			}

			const id = nanoid();
			const shareId = nanoid(10);
			const stmt = this.db.prepare(`
				INSERT INTO forms (id, user_id, title, description, questions, share_id)
				VALUES (?, ?, ?, ?, ?, ?)
			`);
			
			const cleanedTitle = (title || '').trim();
			const cleanedDescription = (description || '').trim();
			const cleanedQuestions = this.validateAndCleanQuestions(questions);

			stmt.run(id, userId, cleanedTitle, cleanedDescription, JSON.stringify(cleanedQuestions), shareId);
			return { formId: id, shareId };
		} catch (error) {
			console.error('Error creating form:', error);
			throw error;
		}
	}

	updateForm(formId, userId, title, description, questions) {
		try {
			// Verify user exists
			const user = this.db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
			if (!user) {
				throw new Error('User not found');
			}

			const form = this.getFormById(formId);
			if (!form) {
				throw new Error('Form not found');
			}
			if (form.user_id !== userId) {
				throw new Error('Access denied');
			}

			const stmt = this.db.prepare(`
				UPDATE forms 
				SET title = ?, description = ?, questions = ?
				WHERE id = ? AND user_id = ?
			`);
			
			const cleanedTitle = (title || '').trim();
			const cleanedDescription = (description || '').trim();
			const cleanedQuestions = this.validateAndCleanQuestions(questions);

			stmt.run(
				cleanedTitle,
				cleanedDescription,
				JSON.stringify(cleanedQuestions),
				formId,
				userId
			);

			return { formId, shareId: form.share_id };
		} catch (error) {
			console.error('Error updating form:', error);
			throw error;
		}
	}

	getAllForms(userId) {
		const stmt = this.db.prepare('SELECT * FROM forms WHERE user_id = ? ORDER BY created_at DESC');
		const forms = stmt.all(userId);
		return forms.map(form => ({
			...form,
			questions: JSON.parse(form.questions)
		}));
	}

	getFormByShareId(shareId) {
		const form = this.db.prepare('SELECT * FROM forms WHERE share_id = ?').get(shareId);
		if (!form) return null;
		return {
			...form,
			questions: JSON.parse(form.questions)
		};
	}

	getFormById(formId) {
		const form = this.db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
		if (!form) return null;
		return {
			...form,
			questions: JSON.parse(form.questions)
		};
	}

	submitResponse(formId, responses) {
		try {
			const id = nanoid();
			console.log('Submitting response:', { formId, responses }); // Debug log

			// Validate responses is an array
			if (!Array.isArray(responses)) {
				console.error('Invalid response format, expected array');
				throw new Error('Invalid response format');
			}

			const stmt = this.db.prepare(`
				INSERT INTO responses (id, form_id, response_data)
				VALUES (?, ?, ?)
			`);

			const responseData = JSON.stringify(responses);
			console.log('Storing response data:', responseData); // Debug log

			stmt.run(id, formId, responseData);
			this.checkDatabaseResponses(formId); // Debug check after submission
			return id;
		} catch (error) {
			console.error('Error submitting response:', error);
			throw error;
		}
	}

	getFormResponses(formId) {
		try {
			// First check if the form exists
			const form = this.db.prepare('SELECT id FROM forms WHERE id = ?').get(formId);
			if (!form) {
				console.error(`Form not found with ID: ${formId}`);
				return [];
			}

			// Get responses with error handling
			const responses = this.db.prepare(
				'SELECT * FROM responses WHERE form_id = ? ORDER BY created_at DESC'
			).all(formId);

			console.log(`Found ${responses.length} responses for form ${formId}`);
			
			// Debug log raw responses
			console.log('Raw responses:', responses);

			return responses.map(response => {
				try {
					const parsedData = JSON.parse(response.response_data);
					console.log(`Parsed response data for ${response.id}:`, parsedData);
					return {
						id: response.id,
						form_id: response.form_id,
						created_at: response.created_at,
						response_data: parsedData
					};
				} catch (parseError) {
					console.error(`Error parsing response data for response ${response.id}:`, parseError);
					return {
						id: response.id,
						form_id: response.form_id,
						created_at: response.created_at,
						response_data: []
					};
				}
			});
		} catch (error) {
			console.error(`Error getting form responses for form ${formId}:`, error);
			return [];
		}
	}

	checkDatabaseResponses(formId) {
		try {
			// Check if form exists
			const form = this.db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
			console.log('Form data:', form);

			// Get raw responses from database
			const responses = this.db.prepare('SELECT * FROM responses WHERE form_id = ?').all(formId);
			console.log('Raw responses from database:', responses);

			// Try to parse each response
			responses.forEach(response => {
				try {
					const parsed = JSON.parse(response.response_data);
					console.log(`Parsed response ${response.id}:`, parsed);
				} catch (e) {
					console.error(`Failed to parse response ${response.id}:`, e);
				}
			});

			return responses;
		} catch (error) {
			console.error('Error checking database responses:', error);
			return [];
		}
	}

	deleteForm(formId) {
		const transaction = this.db.transaction(() => {
			this.db.prepare('DELETE FROM responses WHERE form_id = ?').run(formId);
			const result = this.db.prepare('DELETE FROM forms WHERE id = ?').run(formId);
			return result.changes > 0;
		});

		return transaction();
	}

	getResponseCount(formId) {
		const result = this.db.prepare('SELECT COUNT(*) as count FROM responses WHERE form_id = ?')
			.get(formId);
		return result.count;
	}

	close() {
		this.db.close();
	}
}

module.exports = new DatabaseManager();