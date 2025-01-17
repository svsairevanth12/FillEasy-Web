const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIFormGenerator {
	constructor(apiKey) {
		if (!apiKey) {
			throw new Error('API key is required');
		}
		this.genAI = new GoogleGenerativeAI(apiKey);
	}

	async generateForm(prompt) {
		try {
			console.log('Initializing AI model...');
			const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
			
			const systemPrompt = `Create a comprehensive and professional form structure for: ${prompt}

Detailed Instructions:
1. Form Structure Requirements:
   - Create a logical flow of questions
   - Group related fields together
   - Ensure all essential information is captured
   - Use appropriate validation requirements

2. Question Types to Include:
   - "short": For brief text responses (names, IDs, etc.)
   - "paragraph": For longer text responses (addresses, descriptions)
   - "multiple": For single-choice questions with radio buttons (MUST include 2-5 specific, non-empty options)
   - "checkbox": For multiple-choice questions (MUST include 2-5 specific, non-empty options)
   - "dropdown": For selection from a list of options (MUST include 2-5 specific, non-empty options)

3. Field Requirements:
   - Mark essential fields as required=true
   - Provide clear, professional question text
   - For multiple choice, checkbox, and dropdown fields:
     * Each option MUST be specific and meaningful
     * NO empty options or placeholder text
     * Between 2-5 relevant options per question
     * Options should be complete phrases/words
   - Include helpful placeholder text where appropriate

4. Best Practices:
   - Use clear, concise language
   - Follow a logical order
   - Include all necessary fields for the use case
   - Ensure options are relevant and complete
   - No generic options like "Option 1, Option 2"

Return the result in this exact JSON format:
{
	"title": "A clear, professional title for the form",
	"description": "A detailed description explaining the form's purpose and any special instructions",
	"questions": [
		{
			"id": "q1",
			"type": "short|paragraph|multiple|checkbox|dropdown",
			"question": "Clear question text",
			"required": true|false,
			"options": ["Specific Option 1", "Specific Option 2"] // Required for multiple, checkbox, or dropdown types
		}
	]
}

Important: 
- Ensure all questions are directly relevant to: ${prompt}
- Generate 5-8 relevant questions to comprehensively cover the topic
- All options must be specific and meaningful, never generic placeholders`;

			console.log('Sending prompt to AI...');
			const result = await model.generateContent(systemPrompt);
			console.log('Received response from AI');
			const response = await result.response;
			const text = response.text();
			console.log('Raw AI response:', text);
			
			try {
				// Extract JSON from the response
				const jsonMatch = text.match(/\{[\s\S]*\}/);
				if (!jsonMatch) {
					throw new Error('No JSON found in response');
				}
				const formData = JSON.parse(jsonMatch[0]);
				
				// Validate form structure
				if (!formData.title || !Array.isArray(formData.questions)) {
					throw new Error('Invalid form structure');
				}

				// Enhanced validation and cleaning of questions and options
				formData.questions = formData.questions.map((q, index) => {
					// Basic question structure
					const cleanedQuestion = {
						...q,
						id: q.id || `q${index + 1}`,
						required: typeof q.required === 'boolean' ? q.required : false,
						question: q.question.trim(),
						type: q.type.toLowerCase()
					};

					// Enhanced options handling for choice-based questions
					if (['multiple', 'checkbox', 'dropdown'].includes(cleanedQuestion.type)) {
						// Ensure options exist and are properly formatted
						if (!Array.isArray(q.options) || q.options.length < 2) {
							throw new Error(`Question ${index + 1} must have at least 2 options`);
						}

						// Clean and validate options
						cleanedQuestion.options = q.options
							.map(opt => opt.trim())
							.filter(opt => opt && opt.length > 0) // Remove empty options
							.map(opt => opt.replace(/^Option \d+:?\s*/i, '')); // Remove "Option X:" prefixes

						// Validate after cleaning
						if (cleanedQuestion.options.length < 2) {
							throw new Error(`Question ${index + 1} must have at least 2 valid options after cleaning`);
						}
					} else {
						cleanedQuestion.options = [];
					}

					return cleanedQuestion;
				});

				console.log('Successfully generated form structure:', formData);
				return formData;
			} catch (parseError) {
				console.error('Error parsing AI response:', parseError);
				console.error('Raw text:', text);
				throw new Error('Failed to generate valid form structure: ' + parseError.message);
			}
		} catch (error) {
			console.error('Error in generateForm:', error);
			throw error;
		}
	}
}

module.exports = AIFormGenerator;