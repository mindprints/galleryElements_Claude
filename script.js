function f(k) {
	if(Math.abs(k) > .5)
		scrollTo(0, .5*(k - Math.sign(k) + 1)*(document.documentElement.offsetHeight - window.innerHeight))
}

f(-1);

addEventListener('scroll', e => f(+getComputedStyle(document.body).getPropertyValue('--k')))

document.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		const articles = document.querySelectorAll('article');
		const k = parseFloat(getComputedStyle(document.body).getPropertyValue('--k'));
		
		articles.forEach((article, index) => {
			const titleOpacity = getComputedStyle(article.querySelector('h2')).opacity;
			const j = index / articles.length;
			const diff = Math.abs(j - ((k + 1) % 1));
			
			if (titleOpacity === '1' && diff < 0.05) {
				const currentHov = article.style.getPropertyValue('--hov');
				if (currentHov === '1') {
					article.style.removeProperty('--hov');
				} else {
					article.style.setProperty('--hov', '1');
				}
			}
		});
	}
});
