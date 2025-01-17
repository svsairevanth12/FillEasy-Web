const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { nanoid } = require('nanoid');
const db = require('./db');
const AIFormGenerator = require('./ai-form-generator');

const app = express();
const port = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const aiFormGenerator = new AIFormGenerator(GEMINI_API_KEY);

// Middleware
app.use(cors({
	origin: '*',
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Authentication middleware
const authenticateToken = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	jwt.verify(token, JWT_SECRET, (err, user) => {
		if (err) {
			return res.status(403).json({ error: 'Invalid or expired token' });
		}
		req.user = user;
		next();
	});
};

// Auth endpoints
app.post('/api/auth/register', (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) {
			return res.status(400).json({ error: 'Email and password are required' });
		}

		const existingUser = db.getUserByEmail(email);
		if (existingUser) {
			return res.status(400).json({ error: 'Email already registered' });
		}

		const userId = db.createUser(email, password);
		const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '24h' });
		
		console.log('User registered successfully:', { userId, email });
		res.json({ token, user: { id: userId, email } });
	} catch (error) {
		console.error('Registration error:', error);
		res.status(500).json({ error: 'Failed to register user' });
	}
});

app.post('/api/auth/login', (req, res) => {
	try {
		const { email, password } = req.body;
		console.log('Login attempt for:', email);

		if (!email || !password) {
			return res.status(400).json({ error: 'Email and password are required' });
		}

		const user = db.validateUser(email, password);
		console.log('User validation result:', user ? 'success' : 'failed');
		
		if (!user) {
			return res.status(401).json({ error: 'Invalid email or password' });
		}

		const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
		console.log('Login successful for:', email);
		res.json({ token, user: { id: user.id, email: user.email } });
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({ error: 'Failed to login' });
	}
});

app.post('/api/auth/forgot-password', async (req, res) => {
	try {
		const { email } = req.body;
		const user = db.getUserByEmail(email);
		
		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}

		const resetToken = nanoid();
		db.setResetToken(email, resetToken);

		// For the test account, show the token directly
		if (email === 'test@gmail.com') {
			res.json({ 
				message: 'For the test account, your reset token is: ' + resetToken,
				resetToken 
			});
		} else {
			res.json({ 
				message: 'Please contact your domain admin to reset password',
				resetToken 
			});
		}
	} catch (error) {
		console.error('Password reset error:', error);
		res.status(500).json({ error: 'Failed to process password reset' });
	}
});

app.post('/api/auth/reset-password', (req, res) => {
	try {
		const { token, newPassword } = req.body;
		const user = db.validateResetToken(token);
		
		if (!user) {
			return res.status(400).json({ error: 'Invalid or expired reset token' });
		}

		db.updatePassword(user.id, newPassword);
		res.json({ message: 'Password updated successfully' });
	} catch (error) {
		console.error('Password update error:', error);
		res.status(500).json({ error: 'Failed to update password' });
	}
});

// Serve static files and routes
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, '..', 'landing.html'));
});

app.get('/login', (req, res) => {
	res.sendFile(path.join(__dirname, '..', 'login.html'));
});

app.get('/register', (req, res) => {
	res.sendFile(path.join(__dirname, '..', 'register.html'));
});

app.get('/reset-password', (req, res) => {
	res.sendFile(path.join(__dirname, '..', 'reset-password.html'));
});

app.get('/form-builder', (req, res) => {
	res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/forms', (req, res) => {
	res.sendFile(path.join(__dirname, '..', 'forms.html'));
});

// API endpoints
app.get('/api/forms', authenticateToken, (req, res) => {
	try {
		const forms = db.getAllForms(req.user.id);
		res.json(forms);
	} catch (error) {
		console.error('Error fetching forms:', error);
		res.status(500).json({ error: 'Failed to fetch forms' });
	}
});

app.post('/api/forms', authenticateToken, (req, res) => {
	try {
		const { title, description, questions } = req.body;
		const result = db.createForm(req.user.id, title, description, questions);
		res.json({
			success: true,
			...result
		});
	} catch (error) {
		console.error('Error creating form:', error);
		res.status(500).json({ success: false, error: 'Failed to create form' });
	}
});

app.put('/api/forms/:formId', authenticateToken, (req, res) => {
	try {
		const { title, description, questions } = req.body;
		const result = db.updateForm(req.params.formId, req.user.id, title, description, questions);
		res.json({
			success: true,
			...result
		});
	} catch (error) {
		console.error('Error updating form:', error);
		if (error.message === 'Form not found') {
			res.status(404).json({ success: false, error: 'Form not found' });
		} else if (error.message === 'Access denied') {
			res.status(403).json({ success: false, error: 'Access denied' });
		} else {
			res.status(500).json({ success: false, error: 'Failed to update form' });
		}
	}
});

// Generate form using AI
app.post('/api/forms/generate', authenticateToken, async (req, res) => {
	try {
		console.log('Received generate form request:', req.body);
		
		if (!process.env.GEMINI_API_KEY) {
			console.error('Gemini API key not configured');
			return res.status(400).json({ 
				error: 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.' 
			});
		}

		const { prompt } = req.body;
		if (!prompt) {
			console.error('No prompt provided');
			return res.status(400).json({ error: 'Prompt is required' });
		}

		console.log('Generating form with prompt:', prompt);
		const formStructure = await aiFormGenerator.generateForm(prompt);
		console.log('Generated form structure:', formStructure);
		
		// Create the form in the database with user ID
		const { formId, shareId } = db.createForm(
			req.user.id,
			formStructure.title,
			formStructure.description,
			formStructure.questions
		);

		console.log('Form created with ID:', formId);
		res.json({
			success: true,
			formId,
			shareId,
			form: formStructure
		});
	} catch (error) {
		console.error('Error generating form:', error);
		res.status(500).json({ 
			error: 'Failed to generate form',
			details: error.message 
		});
	}
});

// Get form by share ID
app.get('/api/forms/share/:shareId', (req, res) => {
	try {
		const form = db.getFormByShareId(req.params.shareId);
		if (!form) {
			return res.status(404).json({ error: 'Form not found' });
		}
		res.json(form);
	} catch (error) {
		console.error('Error fetching form:', error);
		res.status(500).json({ error: 'Failed to fetch form' });
	}
});

// Get form by ID
app.get('/api/forms/:formId', authenticateToken, (req, res) => {
	try {
		const form = db.getFormById(req.params.formId);
		if (!form) {
			return res.status(404).json({ error: 'Form not found' });
		}
		// Only return the form if it belongs to the user
		if (form.user_id !== req.user.id) {
			return res.status(403).json({ error: 'Access denied' });
		}
		res.json(form);
	} catch (error) {
		console.error('Error fetching form:', error);
		res.status(500).json({ error: 'Failed to fetch form' });
	}
});

// Submit form response
app.post('/api/forms/:formId/responses', (req, res) => {
	try {
		const { formId } = req.params;
		const { responses } = req.body;
		
		// Verify form exists
		const form = db.getFormById(formId);
		if (!form) {
			return res.status(404).json({ error: 'Form not found' });
		}

		const responseId = db.submitResponse(formId, responses);
		res.json({
			success: true,
			responseId
		});
	} catch (error) {
		console.error('Error submitting response:', error);
		res.status(500).json({ success: false, error: 'Failed to submit response' });
	}
});

// Get form responses
app.get('/api/forms/:formId/responses', authenticateToken, (req, res) => {
	try {
		const form = db.getFormById(req.params.formId);
		if (!form) {
			return res.status(404).json({ error: 'Form not found' });
		}
		if (form.user_id !== req.user.id) {
			return res.status(403).json({ error: 'Access denied' });
		}
		const responses = db.getFormResponses(req.params.formId);
		res.json(responses);
	} catch (error) {
		console.error('Error fetching responses:', error);
		res.status(500).json({ error: 'Failed to fetch responses' });
	}
});

// Export form responses as CSV
app.get('/api/forms/:formId/export', authenticateToken, (req, res) => {
	try {
		const form = db.getFormById(req.params.formId);
		if (!form) {
			return res.status(404).json({ error: 'Form not found' });
		}
		if (form.user_id !== req.user.id) {
			return res.status(403).json({ error: 'Access denied' });
		}

		const responses = db.getFormResponses(req.params.formId);
		
		// Create CSV header from questions
		const questions = form.questions.map(q => q.question);
		let csv = questions.join(',') + '\n';

		// Add each response as a row
		responses.forEach(response => {
			const row = form.questions.map(question => {
				const answer = response.response_data.find(r => r.question === question.question);
				// Handle array responses (checkboxes) and escape commas
				const value = answer ? (Array.isArray(answer.response) ? 
					answer.response.join(';') : 
					answer.response) : '';
				return `"${value.replace(/"/g, '""')}"`;
			});
			csv += row.join(',') + '\n';
		});

		// Set headers for file download
		res.setHeader('Content-Type', 'text/csv');
		res.setHeader('Content-Disposition', `attachment; filename=${form.title || 'form'}_responses.csv`);
		res.send(csv);
	} catch (error) {
		console.error('Error exporting responses:', error);
		res.status(500).json({ error: 'Failed to export responses' });
	}
});

// Get response count
app.get('/api/forms/:formId/response-count', authenticateToken, (req, res) => {
	try {
		const form = db.getFormById(req.params.formId);
		if (!form) {
			return res.status(404).json({ error: 'Form not found' });
		}
		if (form.user_id !== req.user.id) {
			return res.status(403).json({ error: 'Access denied' });
		}
		const count = db.getResponseCount(req.params.formId);
		res.json({ count });
	} catch (error) {
		console.error('Error fetching response count:', error);
		res.status(500).json({ error: 'Failed to fetch response count' });
	}
});

// Delete form
app.delete('/api/forms/:formId', authenticateToken, (req, res) => {
	try {
		const form = db.getFormById(req.params.formId);
		if (!form) {
			return res.status(404).json({ error: 'Form not found' });
		}
		if (form.user_id !== req.user.id) {
			return res.status(403).json({ error: 'Access denied' });
		}
		const success = db.deleteForm(req.params.formId);
		res.json({ success: true });
	} catch (error) {
		console.error('Error deleting form:', error);
		res.status(500).json({ success: false, error: 'Failed to delete form' });
	}
});

app.use(express.static(path.join(__dirname, '..')));
app.use('/share', express.static(path.join(__dirname, 'public')));

// Start server
app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});

// Handle cleanup on exit
process.on('SIGINT', () => {
	db.close();
	process.exit();
});
