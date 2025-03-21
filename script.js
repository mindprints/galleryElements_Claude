function f(k) {
	if(Math.abs(k) > .5)
		scrollTo(0, .5*(k - Math.sign(k) + 1)*(document.documentElement.offsetHeight - window.innerHeight))
}

f(-1);

addEventListener('scroll', e => f(+getComputedStyle(document.body).getPropertyValue('--k')))

// Add click handler
document.addEventListener('click', (e) => {
	// Log to verify click is detected
	console.log('Click detected');
	
	const articles = document.querySelectorAll('article');
	const k = parseFloat(getComputedStyle(document.body).getPropertyValue('--k'));
	
	articles.forEach((article, index) => {
		// Check if article contains the clicked element
		if (article.contains(e.target)) {
			console.log('Article clicked:', index);
			
			const titleOpacity = getComputedStyle(article.querySelector('header')).opacity;
			const j = index / articles.length;
			const diff = Math.abs(j - ((k + 1) % 1));
			
			console.log('Opacity:', titleOpacity, 'Diff:', diff);
			
			if (diff < 0.05) {
				console.log('Flipping article:', index);
				const currentHov = article.style.getPropertyValue('--hov');
				if (currentHov === '1') {
					article.style.removeProperty('--hov');
				} else {
					article.style.setProperty('--hov', '1');
				}
			}
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

// Modify keydown handler to use the same logic
document.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		const centeredArticle = document.querySelector('article.centered');
		if (centeredArticle) {
			const currentHov = centeredArticle.style.getPropertyValue('--hov');
			if (currentHov === '1') {
				centeredArticle.style.removeProperty('--hov');
			} else {
				centeredArticle.style.setProperty('--hov', '1');
			}
		}
	}
});
