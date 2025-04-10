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

		} catch (error) {
			console.error('Error loading posters:', error);
			postersContainer.innerHTML = `<p style="color: red;">Error loading posters: ${error.message}</p>`;
		}
	});

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
});
