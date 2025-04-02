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

    // Load each JSON file and create a poster
    for (let i = 0; i < fileList.length; i++) {
      const filePath = `${directory}/${fileList[i]}`;
      const posterResponse = await fetch(filePath);
      if (!posterResponse.ok) {
        throw new Error(`Failed to load poster: ${filePath}`);
      }

      const posterData = await posterResponse.json();

      const article = document.createElement('article');
      article.style.setProperty('--i', i); // Set --i based on the index

      const header = document.createElement('header');
      header.textContent = posterData.header;

      const figure = document.createElement('figure');
      figure.innerHTML = `<div>${posterData.figure}</div>`;

      article.appendChild(header);
      article.appendChild(figure);
      postersContainer.appendChild(article);
    }

    // Update the --n property to match the number of posters
    document.documentElement.style.setProperty('--n', fileList.length);
  } catch (error) {
    console.error('Error loading posters:', error);
    // Optionally, display an error message to the user
    postersContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
}

// Export the function for use in other scripts
window.loadPosters = loadPosters; 