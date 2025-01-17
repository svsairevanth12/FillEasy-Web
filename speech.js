class SpeechRecognitionUtil {
	constructor() {
		this.recognition = null;
		this.isListening = false;
		this.initSpeechRecognition();
	}

	initSpeechRecognition() {
		if ('webkitSpeechRecognition' in window) {
			this.recognition = new webkitSpeechRecognition();
			this.recognition.continuous = false;
			this.recognition.interimResults = true;
			this.recognition.lang = 'en-US';
		} else {
			console.warn('Speech recognition not supported');
		}
	}

	startListening(onResult, onEnd, onError) {
		if (!this.recognition) {
			alert('Speech recognition is not supported in your browser');
			return;
		}

		if (this.isListening) {
			this.stopListening();
			return;
		}

		this.isListening = true;

		this.recognition.onresult = (event) => {
			const transcript = Array.from(event.results)
				.map(result => result[0].transcript)
				.join('');
			
			onResult(transcript);
		};

		this.recognition.onend = () => {
			this.isListening = false;
			onEnd();
		};

		this.recognition.onerror = (event) => {
			this.isListening = false;
			onError(event.error);
		};

		try {
			this.recognition.start();
		} catch (error) {
			console.error('Error starting speech recognition:', error);
		}
	}

	stopListening() {
		if (this.recognition && this.isListening) {
			this.recognition.stop();
			this.isListening = false;
		}
	}

	addSpeechButton(inputElement, buttonContainer) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'speech-btn';
		button.innerHTML = '<i class="fas fa-microphone"></i>';
		button.title = 'Click to speak';

		const indicator = document.createElement('span');
		indicator.className = 'speech-indicator';
		buttonContainer.appendChild(indicator);

		button.addEventListener('click', () => {
			if (this.isListening) {
				button.classList.remove('listening');
				indicator.textContent = '';
				this.stopListening();
			} else {
				button.classList.add('listening');
				indicator.textContent = 'Listening...';
				
				this.startListening(
					// onResult
					(transcript) => {
						inputElement.value = transcript;
						inputElement.dispatchEvent(new Event('input', { bubbles: true }));
					},
					// onEnd
					() => {
						button.classList.remove('listening');
						indicator.textContent = '';
					},
					// onError
					(error) => {
						console.error('Speech recognition error:', error);
						button.classList.remove('listening');
						indicator.textContent = 'Error: ' + error;
						setTimeout(() => {
							indicator.textContent = '';
						}, 3000);
					}
				);
			}
		});

		buttonContainer.appendChild(button);
	}
}

// Create a global instance
window.speechRecognition = new SpeechRecognitionUtil();