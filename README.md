# Fill Easy - Smart Form Builder

Fill Easy is an AI-powered form builder that allows you to create, manage, and share forms easily. With features like voice input and AI form generation, it makes form creation a breeze.

## Features

- 🤖 AI-powered form generation
- 🎤 Voice input support
- 📊 Response collection and analysis
- 📱 Responsive design
- 🔒 User authentication
- 📤 Form sharing capabilities

## Live Demo

Access the live application at: [Your Deployed URL]

Test Account:
- Email: test@gmail.com
- Password: test

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone [your-repo-url]
   cd [repo-name]
   ```

2. Install dependencies:
   ```bash
   npm install
   cd server
   npm install
   ```

3. Environment variables are included in `server/.env`:
   ```
   PORT=3001
   JWT_SECRET=fill-easy-jwt-secret-key-2024
   GEMINI_API_KEY=AIzaSyAnz8jQAqvc6Q1xXCnpC2A2qjXOmSKpWho
   ```

4. Start the server:
   ```bash
   cd server
   npm start
   ```

5. Access the application:
   - Open `http://localhost:3001` in your browser
   - The landing page will load first
   - Use the test account or create a new account

## Features Guide

### Creating Forms
1. Log in to your account
2. Click "Create New Form" button
3. Add questions using the "Add Question" button
4. Choose from multiple question types:
   - Short Answer
   - Paragraph
   - Multiple Choice
   - Checkboxes
   - Dropdown

### AI Form Generation
1. Click "Generate Form with AI" button
2. Enter a description of the form you need
3. The AI will generate a complete form structure

### Voice Input
- Click the microphone icon next to any text input
- Speak your text
- The input will be automatically filled

### Form Sharing
1. Save your form
2. Click the "Share" button
3. Copy the generated link
4. Share with respondents

### Viewing Responses
1. Go to the Forms Dashboard
2. Click "View Responses" on any form
3. See individual responses
4. Export responses as CSV

## Deployment

The application is ready for deployment on Vercel/Netlify:

1. Push the repository to GitHub
2. Connect your GitHub repository to Vercel/Netlify
3. Deploy - all necessary files are included:
   - Environment variables in `.env`
   - Database file
   - Static files (HTML, CSS, JS)
   - Server code

## Technology Stack

- Frontend:
  - HTML5
  - CSS3
  - Vanilla JavaScript
  - Font Awesome icons

- Backend:
  - Node.js
  - Express.js
  - SQLite (better-sqlite3)
  - JSON Web Tokens (JWT)

- AI Integration:
  - Google Gemini API
  - Web Speech API

## Support

For any issues or questions:
1. Check the existing issues in the GitHub repository
2. Create a new issue if needed
3. Contact the development team

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 