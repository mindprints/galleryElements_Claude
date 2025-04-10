// Define loadPosters in the global scope
// Accepts an array of pre-fetched poster data objects
async function loadPosters(postersDataArray) {
  const postersContainer = document.getElementById('posters-container');
  
  try {
    // Clear existing posters
    postersContainer.innerHTML = '';

    if (!Array.isArray(postersDataArray)) {
      throw new Error('Invalid data provided to loadPosters. Expected an array.');
    }

    if (postersDataArray.length === 0) {
      postersContainer.innerHTML = '<p>No posters found for this selection.</p>';
      // Ensure carousel CSS is updated for zero posters
      document.documentElement.style.setProperty('--n', 0);
      return;
    }

    // --- SORTING --- 
    // Sort posters based on type and available data (e.g., chronology)
    // Note: Journeys should ideally arrive pre-sorted, but directories need sorting.
    postersDataArray.sort((a, b) => {
      const aIsJson = a.type === 'json';
      const bIsJson = b.type === 'json';
      const aHasChrono = aIsJson && a.data?.chronology?.epochStart !== undefined;
      const bHasChrono = bIsJson && b.data?.chronology?.epochStart !== undefined;

      // Both have epochStart, sort by it
      if (aHasChrono && bHasChrono) {
        return a.data.chronology.epochStart - b.data.chronology.epochStart;
      }
      
      // Only A has epochStart, A comes first
      if (aHasChrono) return -1;
      // Only B has epochStart, B comes first
      if (bHasChrono) return 1;

      // Try sorting by earliest epochEvent year if both are JSON and lack epochStart
      if (aIsJson && bIsJson) {
        const aEarliestEvent = a.data?.chronology?.epochEvents?.[0]?.year;
        const bEarliestEvent = b.data?.chronology?.epochEvents?.[0]?.year;
        if (aEarliestEvent !== undefined && bEarliestEvent !== undefined) {
          return aEarliestEvent - bEarliestEvent;
        }
         if (aEarliestEvent !== undefined) return -1;
         if (bEarliestEvent !== undefined) return 1;
      }
      
      // Fallback: Sort everything else by path alphabetically
      return a.path.localeCompare(b.path);
    });
    // --- END SORTING ---

    // Create DOM elements for each poster in sorted order
    for (let i = 0; i < postersDataArray.length; i++) {
      const poster = postersDataArray[i];
      
      // Skip if poster data is somehow invalid (should be filtered by backend)
      if (!poster || !poster.type) continue;

      const article = document.createElement('article');
      article.style.setProperty('--i', i); // Set --i based on the sorted index

      const header = document.createElement('header');
      const figure = document.createElement('figure');

      // --- RENDER POSTER BASED ON TYPE --- 
      try { // Add try-catch around individual poster rendering
        if (poster.type === 'json') {
          const posterData = poster.data;
          if (!posterData) throw new Error(`JSON poster data missing for ${poster.path}`);
          // Create header (back side) - JSON
          if (posterData.header) {
            let formattedText = posterData.header;
            if (formattedText.includes('\\n\\n')) {
              formattedText = formattedText.replace(/\\n\\n/g, '</p><p>');
              header.innerHTML = `<p>${formattedText}</p>`;
            } else if (formattedText.includes('\n\n')) {
              const paragraphs = formattedText.split('\n\n');
              header.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
            } else {
              header.innerHTML = `<p>${formattedText}</p>`;
            }
          }

          // Create figure (front side) - JSON
          let figureHTML = `<div class="title">${posterData.figure || 'Untitled'}</div>`;
          if (posterData.chronology) {
            figureHTML += `<div class="chronology-display">`;
            const hasStart = posterData.chronology.epochStart !== null && posterData.chronology.epochStart !== undefined;
            const hasEnd = posterData.chronology.epochEnd !== null && posterData.chronology.epochEnd !== undefined;
            if (hasStart && hasEnd) {
              figureHTML += `<div class="timeline-dates"><span class="timeline-span">${posterData.chronology.epochStart} — ${posterData.chronology.epochEnd}</span></div>`;
            } else if (hasStart) {
              figureHTML += `<div class="timeline-dates"><span class="timeline-start">${posterData.chronology.epochStart}</span></div>`;
            } else if (hasEnd) {
              figureHTML += `<div class="timeline-dates"><span class="timeline-end">${posterData.chronology.epochEnd}</span></div>`;
            }
            if (posterData.chronology.epochEvents && posterData.chronology.epochEvents.length > 0) {
              figureHTML += `<div class="timeline-events">`;
              posterData.chronology.epochEvents.forEach(event => {
                figureHTML += `<div class="event"><span class="year">${event.year}</span>: ${event.name}</div>`;
              });
              figureHTML += `</div>`;
            }
            figureHTML += `</div>`;
          }
          figure.innerHTML = figureHTML;

        } else if (poster.type === 'image') {
          // This type now refers to a JSON wrapper for an image
          const imageData = poster.data;
          if (!imageData) throw new Error(`Image JSON data missing for ${poster.path}`);
          const imagePath = poster.imagePath || imageData.imagePath; // Use resolved imagePath from backend
          if (!imagePath) throw new Error(`Image path missing in JSON data for ${poster.path}`);
          const title = poster.title || imageData.title || '';
          const description = imageData.description || '';
          const altText = imageData.alt || path.basename(imagePath);
          
          // Create header (back side) - Display the image and description
          header.classList.add('image-poster-header');
          const imageContainer = document.createElement('div');
          imageContainer.classList.add('image-container');
          const headerImg = document.createElement('img');
          headerImg.src = imagePath;
          headerImg.alt = altText;
          headerImg.classList.add('fullsize-image');
          imageContainer.appendChild(headerImg);
          if (description) {
            const descriptionElem = document.createElement('div');
            descriptionElem.classList.add('image-description');
            descriptionElem.innerHTML = `<p>${description}</p>`;
            imageContainer.appendChild(descriptionElem);
          }
          header.appendChild(imageContainer);

          // Create figure (front side) - Image with optional title
          figure.classList.add('image-poster-figure');
          const img = document.createElement('img');
          img.src = imagePath;
          img.alt = altText;
          figure.appendChild(img);
          if (title) {
            const titleElem = document.createElement('div');
            titleElem.classList.add('title');
            titleElem.textContent = title;
            figure.appendChild(titleElem);
          }
          // Render annotations if present (using data from JSON)
          if (imageData.annotations && imageData.annotations.length > 0) {
            const annotationsContainer = document.createElement('div');
            annotationsContainer.classList.add('annotations-container');
            imageData.annotations.forEach(annotation => {
              const annotationElem = document.createElement('div');
              annotationElem.classList.add('annotation');
              annotationElem.textContent = annotation.text;
              if (annotation.position) {
                annotationElem.style.position = 'absolute'; // Ensure positioning context
                annotationElem.style.left = `${annotation.position.x}%`;
                annotationElem.style.top = `${annotation.position.y}%`;
              }
              annotationsContainer.appendChild(annotationElem);
            });
            figure.appendChild(annotationsContainer);
          }

        } else if (poster.type === 'direct-image') {
          // This type refers to an image file loaded directly
          const imagePath = poster.path;
          if (!imagePath) throw new Error(`Direct image path missing`);
          const filename = poster.filename || path.basename(imagePath);
          const altText = filename;
          
          // Create header (back side) - Display the image
          header.classList.add('image-poster-header');
          const headerImg = document.createElement('img');
          headerImg.src = imagePath;
          headerImg.alt = altText;
          headerImg.classList.add('fullsize-image');
          header.appendChild(headerImg);

          // Create figure (front side) - Image
          figure.classList.add('image-poster-figure');
          const img = document.createElement('img');
          img.src = imagePath;
          img.alt = altText;
          figure.appendChild(img);

        } else if (poster.type === 'website') {
          const websiteData = poster.data;
          if (!websiteData) throw new Error(`Website JSON data missing for ${poster.path}`);
          if (!websiteData.url) throw new Error(`Website URL missing in JSON data for ${poster.path}`);
          
          const url = websiteData.url;
          const title = poster.title || websiteData.title || new URL(url).hostname;
          const description = websiteData.description || 'View this website in a new tab';
          const domain = new URL(url).hostname;
          const faviconUrl = `https://${domain}/favicon.ico`;
          const thumbnailPath = poster.thumbnail || websiteData.thumbnail; // Use resolved path first

          // Create header (back side) - Website preview with link
          header.classList.add('website-poster-header');
          const previewContainer = document.createElement('div');
          previewContainer.classList.add('website-preview-container');
          const websiteInfo = document.createElement('div');
          websiteInfo.classList.add('website-info');
          const iconContainer = document.createElement('div');
          iconContainer.classList.add('website-icon');
          const favicon = document.createElement('img');
          favicon.src = faviconUrl;
          favicon.alt = '';
          favicon.onerror = () => { favicon.src = 'logos/favicon_io/favicon-32x32.png'; };
          iconContainer.appendChild(favicon);
          websiteInfo.innerHTML = `
            <h2>${title}</h2>
            <p class="website-url">${url}</p>
            <p class="website-description">${description}</p>
            <div class="website-buttons">
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="website-open-button">Open Website</a>
            </div>
          `;
          websiteInfo.insertBefore(iconContainer, websiteInfo.firstChild);
          previewContainer.appendChild(websiteInfo);
          header.appendChild(previewContainer);

          // Create figure (front side) - Title/Thumbnail/Icon
          figure.classList.add('website-poster-figure');
          const frontsideContainer = document.createElement('div');
          frontsideContainer.classList.add('website-frontside-container');
          const frontIconContainer = document.createElement('div');
          frontIconContainer.classList.add('website-frontside-icon');
          const frontFavicon = document.createElement('img');
          frontFavicon.src = faviconUrl;
          frontFavicon.alt = '';
          frontFavicon.onerror = () => { frontFavicon.src = 'logos/favicon_io/favicon-32x32.png'; };
          frontIconContainer.appendChild(frontFavicon);
          const websiteTitle = document.createElement('div');
          websiteTitle.classList.add('title');
          websiteTitle.textContent = title;
          const websiteDesc = document.createElement('div');
          websiteDesc.classList.add('website-brief-description');
          if (websiteData.description) { // Only use explicit description
            websiteDesc.textContent = websiteData.description;
          }
          frontsideContainer.appendChild(frontIconContainer);
          frontsideContainer.appendChild(websiteTitle);
          if (websiteDesc.textContent) {
             frontsideContainer.appendChild(websiteDesc);
          }

          // Thumbnail logic
          const isPlaceholder = !thumbnailPath || 
                             thumbnailPath.includes('/optional/') || 
                             thumbnailPath.startsWith('path/to/') || 
                             thumbnailPath === 'thumbnail.png';
                             
          if (thumbnailPath && !isPlaceholder) {
            const thumbContainer = document.createElement('div');
            thumbContainer.classList.add('thumbnail-container');
            const thumbImg = document.createElement('img');
            thumbImg.alt = `${title} Thumbnail`;
            thumbImg.classList.add('website-thumbnail');
            thumbImg.src = 'logos/favicon_io/android-chrome-512x512.png'; // Placeholder
            
            const testImg = new Image();
            testImg.onload = () => {
              thumbImg.src = thumbnailPath;
              thumbContainer.style.display = 'block'; 
              frontsideContainer.style.display = 'none'; // Hide title/icon if thumb loads
            };
            testImg.onerror = () => {
              thumbContainer.style.display = 'none'; // Hide thumb if it fails
              frontsideContainer.style.display = 'flex'; 
              console.warn(`Failed to load website thumbnail: ${thumbnailPath}`);
            };
            testImg.src = thumbnailPath;

            thumbContainer.appendChild(thumbImg);
            figure.appendChild(thumbContainer);
            figure.appendChild(frontsideContainer); // Add both, display controlled by load status
            frontsideContainer.style.display = 'none'; // Initially hide non-thumb version
          } else {
            figure.appendChild(frontsideContainer); // No thumbnail, show title/icon version
            frontsideContainer.style.display = 'flex'; 
          }
        } else {
           console.warn(`Unhandled poster type: ${poster.type} for path ${poster.path}`);
           // Optionally create a fallback placeholder appearance
           figure.innerHTML = `<div class="title">Unsupported Poster</div><p>${poster.path}</p>`;
           header.innerHTML = `<p>Cannot display poster type: ${poster.type}</p>`;
        }
      } catch (renderError) {
        console.error(`Error rendering poster ${poster.path || poster.filename}:`, renderError);
        figure.innerHTML = `<div class="title">Render Error</div><p style="color:red;">${renderError.message}</p>`;
        header.innerHTML = `<p>Error rendering poster. Check console.</p>`;
      }
      // --- END RENDER POSTER --- 

      article.appendChild(header);
      article.appendChild(figure);
      postersContainer.appendChild(article);
    }

    // Update the --n property AFTER all posters are added
    document.documentElement.style.setProperty('--n', postersDataArray.length);

    // Update which article is centered after posters are loaded
    if (window.updateCenteredArticle) {
       window.updateCenteredArticle();
    }
    // Reset scroll position maybe?
    // scrollTo(0, 0); 

  } catch (error) {
    console.error('Error in loadPosters function:', error);
    postersContainer.innerHTML = `<p style="color: red;">Error loading posters: ${error.message}</p>`;
    // Ensure --n is 0 on error
    document.documentElement.style.setProperty('--n', 0);
  }
}

// Export the function for use in other scripts (if not already global)
// Ensure it's accessible, e.g., by assigning to window
window.loadPosters = loadPosters; 