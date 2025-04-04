// Define loadPosters in the global scope
async function loadPosters(directory) {
  const postersContainer = document.getElementById('posters-container');
  
  try {
    // Clear existing posters
    postersContainer.innerHTML = '';

    // Fetch the list of JSON files from the server
    const response = await fetch(`/api/posters?directory=${directory}`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const fileList = await response.json();
    let postersData = [];

    // Load all JSON data first
    for (let i = 0; i < fileList.length; i++) {
      const filePath = `${directory}/${fileList[i]}`;
      const posterResponse = await fetch(filePath);
      if (!posterResponse.ok) {
        throw new Error(`Failed to load poster: ${filePath}`);
      }
      const posterData = await posterResponse.json();
      postersData.push(posterData);
    }

    // Sort posters by chronology
    postersData.sort((a, b) => {
      // Primary sort by epochStart if available
      if (a.chronology?.epochStart !== undefined && b.chronology?.epochStart !== undefined) {
        return a.chronology.epochStart - b.chronology.epochStart;
      }
      
      // If one has epochStart and other doesn't, prioritize the one with epochStart
      if (a.chronology?.epochStart !== undefined) return -1;
      if (b.chronology?.epochStart !== undefined) return 1;
      
      // If neither has epochStart, try sorting by earliest epochEvent
      const aEarliestEvent = a.chronology?.epochEvents?.[0]?.year;
      const bEarliestEvent = b.chronology?.epochEvents?.[0]?.year;
      
      if (aEarliestEvent !== undefined && bEarliestEvent !== undefined) {
        return aEarliestEvent - bEarliestEvent;
      }
      
      // If all else fails, maintain original order
      return 0;
    });

    // Create DOM elements for each poster in sorted order
    for (let i = 0; i < postersData.length; i++) {
      const posterData = postersData[i];
      
      const article = document.createElement('article');
      article.style.setProperty('--i', i); // Set --i based on the sorted index

      // Create header (back side)
      const header = document.createElement('header');
      // Handle text formatting with paragraphs
      if (posterData.header) {
        // First handle literal "\n\n" strings (as seen in the JSON file)
        let formattedText = posterData.header;
        
        // Check if we have literal \n\n in the string
        if (formattedText.includes('\\n\\n')) {
          formattedText = formattedText.replace(/\\n\\n/g, '</p><p>');
          header.innerHTML = `<p>${formattedText}</p>`;
        } 
        // Fallback to handling actual newlines if present
        else if (formattedText.includes('\n\n')) {
          const paragraphs = formattedText.split('\n\n');
          header.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
        }
        // If no paragraph breaks detected, just set as a single paragraph
        else {
          header.innerHTML = `<p>${formattedText}</p>`;
        }
      }

      // Create figure (front side)
      const figure = document.createElement('figure');
      
      // Create the center-aligned front side with the title first
      let figureHTML = `<div class="title">${posterData.figure}</div>`;
      
      // Add chronology information if available
      if (posterData.chronology) {
        figureHTML += `<div class="chronology-display">`;
        
        // Show start and end dates with em dash if both exist
        const hasStart = posterData.chronology.epochStart !== null && posterData.chronology.epochStart !== undefined;
        const hasEnd = posterData.chronology.epochEnd !== null && posterData.chronology.epochEnd !== undefined;
        
        if (hasStart && hasEnd) {
          figureHTML += `<div class="timeline-dates">`;
          figureHTML += `<span class="timeline-span">${posterData.chronology.epochStart} — ${posterData.chronology.epochEnd}</span>`;
          figureHTML += `</div>`;
        } else if (hasStart) {
          figureHTML += `<div class="timeline-start">${posterData.chronology.epochStart}</div>`;
        } else if (hasEnd) {
          figureHTML += `<div class="timeline-end">${posterData.chronology.epochEnd}</div>`;
        }
        
        // Add events if any
        if (posterData.chronology.epochEvents && posterData.chronology.epochEvents.length > 0) {
          figureHTML += `<div class="timeline-events">`;
          for (const event of posterData.chronology.epochEvents) {
            figureHTML += `<div class="event"><span class="year">${event.year}</span>: ${event.name}</div>`;
          }
          figureHTML += `</div>`;
        }
        
        figureHTML += `</div>`;
      }
      
      figure.innerHTML = figureHTML;

      article.appendChild(header);
      article.appendChild(figure);
      postersContainer.appendChild(article);
    }

    // Update the --n property to match the number of posters
    document.documentElement.style.setProperty('--n', postersData.length);
  } catch (error) {
    console.error('Error loading posters:', error);
    // Optionally, display an error message to the user
    postersContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
}

// Export the function for use in other scripts
window.loadPosters = loadPosters; 