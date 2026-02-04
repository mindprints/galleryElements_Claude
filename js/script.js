function f(k) {
	if(Math.abs(k) > .5)
		scrollTo(0, .5*(k - Math.sign(k) + 1)*(document.documentElement.offsetHeight - window.innerHeight))
}

f(-1);

addEventListener('scroll', e => f(+getComputedStyle(document.body).getPropertyValue('--k')));

// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
	const chooser = document.getElementById('directory-chooser');
	const postersContainer = document.getElementById('posters-container');
	const rotationSpeedInput = document.getElementById('rotation-speed');
	const rotationSpeedValue = document.getElementById('rotation-speed-value');
	const DEFAULT_ROTATION_MS = 10000;
	const DEFAULT_SECONDS_PER_CARD = 10;
	let autoRotateActive = false;
	let autoRotateId = null;
	let lastAutoRotateTime = 0;
	let userInputPaused = false;
	let secondsPerCard = DEFAULT_SECONDS_PER_CARD;

	function getPosterCount() {
		return postersContainer.querySelectorAll('article').length || 1;
	}

	function getRotationDurationMs() {
		return Math.max(1, getPosterCount()) * secondsPerCard * 1000;
	}

	function initializeRotationSpeedControl() {
		if (!rotationSpeedInput || !rotationSpeedValue) return;

		const storedSeconds = Number.parseInt(localStorage.getItem('autoRotateSecondsPerCard'), 10);
		const legacyDurationMs = Number.parseInt(localStorage.getItem('autoRotateDurationMs'), 10);
		const minSeconds = Number.parseInt(rotationSpeedInput.min, 10) || 5;
		const maxSeconds = Number.parseInt(rotationSpeedInput.max, 10) || 30;
		let nextSeconds = DEFAULT_SECONDS_PER_CARD;

		if (Number.isFinite(storedSeconds) && storedSeconds > 0) {
			nextSeconds = storedSeconds;
		} else if (Number.isFinite(legacyDurationMs) && legacyDurationMs > 0) {
			nextSeconds = Math.round((legacyDurationMs / 1000) / getPosterCount());
			localStorage.removeItem('autoRotateDurationMs');
		}

		nextSeconds = Math.min(Math.max(nextSeconds, minSeconds), maxSeconds);
		secondsPerCard = nextSeconds;
		rotationSpeedInput.value = nextSeconds;
		rotationSpeedValue.textContent = `${nextSeconds}s`;
		localStorage.setItem('autoRotateSecondsPerCard', `${nextSeconds}`);

		rotationSpeedInput.addEventListener('input', () => {
			const nextValue = Number.parseInt(rotationSpeedInput.value, 10) || DEFAULT_SECONDS_PER_CARD;
			secondsPerCard = nextValue;
			rotationSpeedValue.textContent = `${nextValue}s`;
			localStorage.setItem('autoRotateSecondsPerCard', `${nextValue}`);
		});

		window.addEventListener('storage', (event) => {
			if (event.key === 'autoRotateSecondsPerCard' && event.newValue) {
				const syncedValue = Number.parseInt(event.newValue, 10);
				if (Number.isFinite(syncedValue) && syncedValue > 0) {
					secondsPerCard = syncedValue;
					rotationSpeedInput.value = syncedValue;
					rotationSpeedValue.textContent = `${syncedValue}s`;
				}
			}
		});
	}

	function stepAutoRotate(timestamp) {
		if (!autoRotateActive) return;
		if (!lastAutoRotateTime) lastAutoRotateTime = timestamp;
		const deltaSeconds = (timestamp - lastAutoRotateTime) / 1000;
		lastAutoRotateTime = timestamp;
		const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
		if (scrollHeight > 0) {
			const distancePerSecond = scrollHeight / (getRotationDurationMs() / 1000);
			const nextScrollTop = (window.scrollY || window.pageYOffset) + (distancePerSecond * deltaSeconds);
			window.scrollTo(0, nextScrollTop);
		}
		autoRotateId = requestAnimationFrame(stepAutoRotate);
	}

	function startAutoRotate() {
		if (autoRotateActive || userInputPaused) return;
		autoRotateActive = true;
		lastAutoRotateTime = 0;
		autoRotateId = requestAnimationFrame(stepAutoRotate);
	}

	function stopAutoRotate() {
		autoRotateActive = false;
		if (autoRotateId) {
			cancelAnimationFrame(autoRotateId);
			autoRotateId = null;
		}
		lastAutoRotateTime = 0;
	}

	function pauseAutoRotateForUserInput() {
		userInputPaused = true;
		stopAutoRotate();
	}

	// Function to open full article
	function openFullArticle(article) {
		const fullArticle = document.querySelector('.full-article');
		const mainContent = document.querySelector('main');
		const articleTitle = article.querySelector('figure div').textContent;
		
		// Hide main content
		mainContent.classList.add('main-hidden');
		
		// Set and show full article
		fullArticle.querySelector('.article-title').textContent = articleTitle;
		fullArticle.style.display = 'block';
		
		// Prevent body scrolling
		document.body.style.overflow = 'hidden';
	}

	// Function to close full article
	function closeFullArticle() {
		const fullArticle = document.querySelector('.full-article');
		const mainContent = document.querySelector('main');
		
		// Hide full article
		fullArticle.style.display = 'none';
		
		// Show main content
		mainContent.classList.remove('main-hidden');
		
		// Restore body scrolling
		document.body.style.overflow = '';
	}

	// Click handler for articles
	document.addEventListener('click', (e) => {
		// Close article logic should be fine
		if (e.target.closest('.close-article')) {
			closeFullArticle();
		}

		// Handle poster flipping / opening
		const clickedArticle = e.target.closest('article');
		if (clickedArticle) {
			stopAutoRotate();
			const articles = Array.from(postersContainer.querySelectorAll('article'));
			const k = parseFloat(getComputedStyle(document.body).getPropertyValue('--k'));
			const index = articles.indexOf(clickedArticle);

			if (index !== -1) {
				const j = index / articles.length;
				const diff = Math.abs(j - ((k + 1) % 1));

				if (diff < 0.05) { // Only allow interaction with the centered poster
					if (e.shiftKey) {
						openFullArticle(clickedArticle);
					} else {
						const currentHov = clickedArticle.style.getPropertyValue('--hov');
						// Reset other posters
						articles.forEach(otherArticle => {
							if (otherArticle !== clickedArticle) {
								otherArticle.style.removeProperty('--hov');
							}
						});
						// Toggle clicked poster
						if (currentHov === '1') {
							clickedArticle.style.removeProperty('--hov');
						} else {
							clickedArticle.style.setProperty('--hov', '1');
						}
					}
				}
			}
		}
	});

	// Keyboard handler
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			closeFullArticle();
			return;
		}

		if (e.key === 'Enter') {
			const centeredArticle = document.querySelector('article.centered');
			if (centeredArticle) {
				if (e.shiftKey) {
					openFullArticle(centeredArticle);
				} else {
					const currentHov = centeredArticle.style.getPropertyValue('--hov');
					
					// First, reset all other posters
					document.querySelectorAll('article').forEach(article => {
						if (article !== centeredArticle) {
							article.style.removeProperty('--hov');
						}
					});
					
					// Then toggle the centered poster
					if (currentHov === '1') {
						centeredArticle.style.removeProperty('--hov');
					} else {
						centeredArticle.style.setProperty('--hov', '1');
					}
				}
			}
		}
	});

	// Function to populate directory/journey chooser
	async function populateChooser() {
		try {
			const response = await fetch('/api/load-options');
			if (!response.ok) {
				throw new Error(`Server returned ${response.status}: ${response.statusText}`);
			}
			const optionsData = await response.json();

			chooser.innerHTML = ''; // Clear existing options

			const directoriesGroup = document.createElement('optgroup');
			directoriesGroup.label = 'Categories';
			const journeysGroup = document.createElement('optgroup');
			journeysGroup.label = 'Journeys';

			let hasDirectories = false;
			let hasJourneys = false;

			optionsData.forEach(item => {
				const option = document.createElement('option');
				option.value = item.value;
				option.textContent = item.name;
				option.dataset.type = item.type; // Store type ('directory' or 'journey')

				if (item.type === 'directory') {
					directoriesGroup.appendChild(option);
					hasDirectories = true;
				} else if (item.type === 'journey') {
					journeysGroup.appendChild(option);
					hasJourneys = true;
				}
			});

			if (hasDirectories) {
				chooser.appendChild(directoriesGroup);
			}
			if (hasJourneys) {
				chooser.appendChild(journeysGroup);
			}

			// Trigger change event to load the default selection
			if (chooser.options.length > 0) {
				chooser.dispatchEvent(new Event('change'));
			}

		} catch (error) {
			console.error('Error populating chooser:', error);
			postersContainer.innerHTML = `<p style="color: red;">Error loading options: ${error.message}</p>`;
		}
	}

	// Event listener for the chooser dropdown
	chooser.addEventListener('change', async (event) => {
		const selectedOption = event.target.options[event.target.selectedIndex];
		const type = selectedOption.dataset.type;
		const value = selectedOption.value;

		if (!type || !value) {
			console.error('Selected option is missing type or value.');
			postersContainer.innerHTML = '<p style="color: red;">Error: Invalid selection.</p>';
			return;
		}

		stopAutoRotate();
		userInputPaused = false;
		postersContainer.innerHTML = '<p>Loading posters...</p>'; // Indicate loading

		try {
			let postersData = [];

			if (type === 'directory') {
				// Load posters from a directory
				const response = await fetch(`/api/posters-in-directory?directory=${encodeURIComponent(value)}`);
				if (!response.ok) {
					throw new Error(`Failed to load directory ${value}: ${response.status} ${response.statusText}`);
				}
				postersData = await response.json();

			} else if (type === 'journey') {
				// Load posters from a journey
				// 1. Fetch the journey file
				const journeyResponse = await fetch(`/api/journey/${value}`);
				if (!journeyResponse.ok) {
					throw new Error(`Failed to load journey ${value}: ${journeyResponse.status} ${journeyResponse.statusText}`);
				}
				const journeyData = await journeyResponse.json();

				// 2. Extract filenames
				const filenames = journeyData.posters?.map(p => p.filename).filter(Boolean) || [];

				// 3. Fetch posters by filenames if there are any
				if (filenames.length > 0) {
					const postersResponse = await fetch('/api/posters-by-filenames', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ filenames })
					});
					if (!postersResponse.ok) {
						throw new Error(`Failed to load posters for journey ${value}: ${postersResponse.status} ${postersResponse.statusText}`);
					}
					postersData = await postersResponse.json();
				} else {
					postersData = []; // Journey is empty
				}
			}

			// Call the global loadPosters function (defined in loadPosters.js)
			if (window.loadPosters) {
				window.loadPosters(postersData);
			} else {
				throw new Error('loadPosters function is not defined globally.');
			}

			startAutoRotate();

		} catch (error) {
			console.error('Error loading posters:', error);
			postersContainer.innerHTML = `<p style="color: red;">Error loading posters: ${error.message}</p>`;
		}
	});

	window.addEventListener('wheel', () => pauseAutoRotateForUserInput(), { passive: true });
	window.addEventListener('touchstart', () => pauseAutoRotateForUserInput(), { passive: true });
	initializeRotationSpeedControl();

	// Initialize the chooser and load initial posters
	populateChooser();

	// Update centered article logic
	function updateCenteredArticle() {
		const articles = document.querySelectorAll('article');
		const k = parseFloat(getComputedStyle(document.body).getPropertyValue('--k'));
		
		// Remove centered class from all articles
		articles.forEach(article => article.classList.remove('centered'));
		
		// Find the most centered article
		let closestArticle = null;
		let smallestDiff = Infinity;
		
		articles.forEach((article, index) => {
			const j = index / articles.length;
			const diff = Math.abs(j - ((k + 1) % 1));
			
			if (diff < smallestDiff) {
				smallestDiff = diff;
				closestArticle = article;
			}
		});
		
		// Add centered class if article is within threshold
		if (closestArticle && smallestDiff < 0.05) {
			closestArticle.classList.add('centered');
		}
	}

	// Scroll event listener
	addEventListener('scroll', e => {
		f(+getComputedStyle(document.body).getPropertyValue('--k'));
		updateCenteredArticle();
	});

	// Initial call for scroll position and centered article
	f(-1);
	updateCenteredArticle();
	startAutoRotate();
});
