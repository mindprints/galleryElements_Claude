function f(k) {
	if(Math.abs(k) > .5)
		scrollTo(0, .5*(k - Math.sign(k) + 1)*(document.documentElement.offsetHeight - window.innerHeight))
}

f(-1);

addEventListener('scroll', e => f(+getComputedStyle(document.body).getPropertyValue('--k')));

// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
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

	// Click handler
	document.addEventListener('click', (e) => {
		const articles = document.querySelectorAll('article');
		const k = parseFloat(getComputedStyle(document.body).getPropertyValue('--k'));
		
		articles.forEach((article, index) => {
			if (article.contains(e.target)) {
				const j = index / articles.length;
				const diff = Math.abs(j - ((k + 1) % 1));
				
				if (diff < 0.05) {
					if (e.shiftKey) {
						openFullArticle(article);
					} else {
						const currentHov = article.style.getPropertyValue('--hov');
						
						// First, reset all posters
						articles.forEach(otherArticle => {
							if (otherArticle !== article) {
								otherArticle.style.removeProperty('--hov');
							}
						});
						
						// Then toggle the clicked poster
						if (currentHov === '1') {
							article.style.removeProperty('--hov');
						} else {
							article.style.setProperty('--hov', '1');
						}
					}
				}
			}
		});
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

	// Close button handler
	const closeButton = document.querySelector('.close-article');
	if (closeButton) {
		closeButton.addEventListener('click', closeFullArticle);
	}

	// Function to populate directory chooser
	async function populateDirectoryChooser() {
		try {
			// Fetch directories
			const dirResponse = await fetch('/api/directories');
			if (!dirResponse.ok) {
				throw new Error(`Server returned ${dirResponse.status}: ${dirResponse.statusText}`);
			}
			
			const directories = await dirResponse.json();
			
			// Fetch journeys
			const journeyResponse = await fetch('/api/journeys');
			if (!journeyResponse.ok) {
				throw new Error(`Server returned ${journeyResponse.status}: ${journeyResponse.statusText}`);
			}
			
			const journeys = await journeyResponse.json();
			
			const chooser = document.getElementById('directory-chooser');
			
			// Clear existing options
			chooser.innerHTML = '';
			
			// Add a divider for directories
			if (directories.length > 0) {
				const dirGroupLabel = document.createElement('optgroup');
				dirGroupLabel.label = 'Categories';
				chooser.appendChild(dirGroupLabel);
				
				// Add each directory as an option
				directories.forEach(directory => {
					const option = document.createElement('option');
					option.value = `JSON_Posters/${directory}`;
					
					// Format the display name (convert camelCase or snake_case to Title Case)
					let displayName = directory
						.replace(/([A-Z])/g, ' $1') // Convert camelCase to spaces
						.replace(/_/g, ' ')         // Convert snake_case to spaces
						.replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
						
					option.textContent = displayName;
					dirGroupLabel.appendChild(option);
				});
			}
			
			// Add journeys if there are any
			if (journeys.length > 0) {
				const journeyGroupLabel = document.createElement('optgroup');
				journeyGroupLabel.label = 'Journeys';
				chooser.appendChild(journeyGroupLabel);
				
				// Add each journey as an option
				journeys.forEach(journey => {
					const option = document.createElement('option');
					option.value = `journey:${journey.filename}`;
					option.textContent = journey.name;
					option.dataset.isJourney = 'true';
					journeyGroupLabel.appendChild(option);
				});
			}
			
			// Select the first option by default
			if (chooser.options.length > 0) {
				chooser.selectedIndex = 0;
			}
		} catch (error) {
			console.error('Error loading directories and journeys:', error);
		}
	}

	// Add event listener for the dropdown menu
	const chooser = document.getElementById('directory-chooser');
	chooser.addEventListener('change', (event) => {
		const selectedValue = event.target.value;
		
		// Check if the selected value is a journey
		if (selectedValue.startsWith('journey:')) {
			const journeyFilename = selectedValue.substring(8); // Remove 'journey:' prefix
			loadJourney(journeyFilename);
		} else {
			loadPosters(selectedValue);
		}
	});

	// Load the directories and initial posters
	populateDirectoryChooser().then(() => {
		// Load the posters for the selected directory
		const chooser = document.getElementById('directory-chooser');
		if (chooser.value) {
			loadPosters(chooser.value);
		} else {
			// Fallback to initialposters if nothing is selected
			loadPosters('JSON_Posters/initialposters');
		}
	});
});

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

// Call on scroll
addEventListener('scroll', e => {
	f(+getComputedStyle(document.body).getPropertyValue('--k'));
	updateCenteredArticle();
});

// Initial call
updateCenteredArticle();

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

// Function to load a journey
async function loadJourney(journeyFilename) {
	try {
		const response = await fetch(`/api/journey/${journeyFilename}`);
		if (!response.ok) {
			throw new Error(`Server returned ${response.status}: ${response.statusText}`);
		}
		
		const journeyData = await response.json();
		
		// Once we have the journey data, load all its posters
		if (journeyData.posters && journeyData.posters.length > 0) {
			loadJourneyPosters(journeyData.posters);
		} else {
			const postersContainer = document.getElementById('posters-container');
			postersContainer.innerHTML = '<div class="empty-journey">This journey does not contain any posters.</div>';
		}
	} catch (error) {
		console.error('Error loading journey:', error);
		alert('Failed to load journey: ' + error.message);
	}
}

// Function to load posters from a journey
async function loadJourneyPosters(postersList) {
	const postersContainer = document.getElementById('posters-container');
	
	try {
		// Clear existing posters
		postersContainer.innerHTML = '';
		
		let postersData = [];
		
		// Load each poster from the journey
		for (let i = 0; i < postersList.length; i++) {
			const posterInfo = postersList[i];
			const filePath = posterInfo.path;
			
			try {
				const posterResponse = await fetch(filePath);
				if (!posterResponse.ok) {
					console.warn(`Failed to load poster: ${filePath}, Status: ${posterResponse.status}`);
					continue; // Skip this file if fetch fails
				}
				
				const posterData = await posterResponse.json();
				// Determine the poster type
				const type = posterData.type || 'json';
				
				postersData.push({ type, data: posterData, path: filePath });
			} catch (error) {
				console.warn(`Failed to process poster: ${filePath}`, error);
			}
		}
		
		// Create DOM elements for each poster in the journey's order
		for (let i = 0; i < postersData.length; i++) {
			const poster = postersData[i];
			
			const article = document.createElement('article');
			article.style.setProperty('--i', i); // Set --i based on the journey index
			
			const header = document.createElement('header');
			const figure = document.createElement('figure');
			
			// Process the poster based on its type
			// This is similar to the code in loadPosters function but simplified for brevity
			if (poster.type === 'json') {
				const posterData = poster.data;
				// Create header (back side)
				if (posterData.header) {
					header.innerHTML = `<p>${posterData.header}</p>`;
				}
				
				// Create figure (front side)
				figure.innerHTML = `<div class="title">${posterData.figure}</div>`;
				
				if (posterData.chronology) {
					// Add chronology display if present
					// ... (same code as in loadPosters)
				}
			} else if (poster.type === 'image') {
				// Handle image type posters
				// ... (same code as in loadPosters)
			} else if (poster.type === 'website') {
				// Handle website type posters
				// ... (same code as in loadPosters)
			}
			
			// Add the header and figure to the article
			article.appendChild(header);
			article.appendChild(figure);
			
			// Add the article to the container
			postersContainer.appendChild(article);
		}
		
		// Update the centered article
		updateCenteredArticle();
	} catch (error) {
		console.error('Error loading journey posters:', error);
		postersContainer.innerHTML = '<div class="error-message">Error loading journey posters: ' + error.message + '</div>';
	}
}
