// website-editor.js - Functionality for the website poster editor

// DOM Elements
const directoryChooser = document.getElementById('directory-chooser');
const postersList = document.getElementById('posters-list');
const editorForm = document.getElementById('website-editor-form');
const newPosterBtn = document.getElementById('new-poster-btn');
const deletePosterBtn = document.getElementById('delete-poster-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const confirmationDialog = document.getElementById('confirmation-dialog');
const dialogConfirmBtn = document.getElementById('dialog-confirm');
const dialogCancelBtn = document.getElementById('dialog-cancel');
const dialogMessage = document.getElementById('dialog-message');
const flipPreviewBtn = document.getElementById('flip-preview-btn');
const previewPoster = document.getElementById('preview-poster');
const newDirectoryBtn = document.getElementById('new-directory-btn');
const newDirectoryDialog = document.getElementById('new-directory-dialog');
const newDirectoryNameInput = document.getElementById('new-directory-name');
const createDirectoryBtn = document.getElementById('create-directory-btn');
const cancelDirectoryBtn = document.getElementById('cancel-directory-btn');
const thumbnailUploadBtn = document.getElementById('thumbnail-upload-btn');
const thumbnailClearBtn = document.getElementById('thumbnail-clear-btn');
const thumbnailPreview = document.getElementById('thumbnail-preview');

// Form fields
const websiteTitleInput = document.getElementById('website-title');
const websiteUrlInput = document.getElementById('website-url');
const websiteDescriptionInput = document.getElementById('website-description');
const websiteThumbnailInput = document.getElementById('website-thumbnail');
const websiteFilenameInput = document.getElementById('website-filename');

// Preview elements
const previewTitle = document.getElementById('preview-title');
const previewDescription = document.getElementById('preview-description');
const previewIcon = document.getElementById('preview-icon');
const previewBackTitle = document.getElementById('preview-back-title');
const previewBackDescription = document.getElementById('preview-back-description');
const previewUrl = document.getElementById('preview-url');
const previewBackIcon = document.getElementById('preview-back-icon');
const previewOpenBtn = document.getElementById('preview-open-btn');

// State variables
let postersData = [];
let selectedPoster = null;
let currentDirectory = '';
let editMode = 'create'; // 'create' or 'edit'
let pendingAction = null;

// Initialize the editor
document.addEventListener('DOMContentLoaded', () => {
  // Load directories and posters
  populateDirectoryChooser();
  
  // Form submission
  editorForm.addEventListener('submit', saveWebsitePoster);
  
  // Button event listeners
  newPosterBtn.addEventListener('click', createNewPoster);
  deletePosterBtn.addEventListener('click', showDeleteConfirmation);
  cancelEditBtn.addEventListener('click', cancelEdit);
  flipPreviewBtn.addEventListener('click', togglePreviewFlip);
  directoryChooser.addEventListener('change', loadPostersFromDirectory);
  
  // New directory dialog
  newDirectoryBtn.addEventListener('click', showNewDirectoryDialog);
  createDirectoryBtn.addEventListener('click', createNewDirectory);
  cancelDirectoryBtn.addEventListener('click', hideNewDirectoryDialog);
  
  // Thumbnail handling
  thumbnailUploadBtn.addEventListener('click', openImageSelector);
  thumbnailClearBtn.addEventListener('click', clearThumbnail);
  
  // Confirmation dialog
  dialogConfirmBtn.addEventListener('click', confirmAction);
  dialogCancelBtn.addEventListener('click', cancelAction);

  // Initialize form fields for live preview
  websiteTitleInput.addEventListener('input', updatePreview);
  websiteUrlInput.addEventListener('input', updatePreview);
  websiteDescriptionInput.addEventListener('input', updatePreview);

});

// Populate directory chooser with JSON_Posters subdirectories
async function populateDirectoryChooser() {
  try {
    const response = await fetch('/api/directories');
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const directories = await response.json();
    
    // Clear existing options
    directoryChooser.innerHTML = '';
    
    // Add each directory as an option
    directories.forEach(directory => {
      const option = document.createElement('option');
      option.value = `JSON_Posters/${directory}`;
      
      // Format the display name
      let displayName = directory
        .replace(/([A-Z])/g, ' $1') // Convert camelCase to spaces
        .replace(/_/g, ' ')         // Convert snake_case to spaces
        .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
      
      option.textContent = displayName;
      directoryChooser.appendChild(option);
    });
    
    // Select the first option by default and load its posters
    if (directoryChooser.options.length > 0) {
      directoryChooser.selectedIndex = 0;
      loadPostersFromDirectory();
    }
  } catch (error) {
    console.error('Error loading directories:', error);
    showErrorMessage('Failed to load directories. Please try again later.');
  }
}

// Load posters from the selected directory
async function loadPostersFromDirectory() {
  currentDirectory = directoryChooser.value;
  
  try {
    // Clear existing posters list
    postersList.innerHTML = '';
    postersData = [];
    
    // Fetch posters from the selected directory
    const response = await fetch(`/api/posters?directory=${currentDirectory}`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const fileList = await response.json();
    
    // Filter for JSON files
    const jsonFiles = fileList.filter(file => file.toLowerCase().endsWith('.json'));
    
    // Load data for each JSON poster
    for (const fileName of jsonFiles) {
      try {
        const filePath = `${currentDirectory}/${fileName}`;
        const posterResponse = await fetch(filePath);
        
        if (!posterResponse.ok) {
          console.warn(`Failed to load JSON poster: ${filePath}`);
          continue;
        }
        
        const posterData = await posterResponse.json();
        
        // Skip non-website posters
        if (posterData.type !== 'website') {
          continue;
        }
        
        postersData.push({
          fileName,
          filePath,
          data: posterData
        });
        
        // Create list item for the poster
        const posterItem = document.createElement('div');
        posterItem.className = 'poster-item';
        posterItem.dataset.fileName = fileName;
        
        // Extract domain from URL for display
        let displayUrl = '';
        try {
          const url = new URL(posterData.url);
          displayUrl = url.hostname;
        } catch (e) {
          displayUrl = posterData.url;
        }
        
        posterItem.innerHTML = `
          <div class="poster-item-title">${posterData.title || 'Untitled'}</div>
          <div class="poster-item-info">${displayUrl}</div>
        `;
        
        posterItem.addEventListener('click', () => selectPoster(fileName));
        
        postersList.appendChild(posterItem);
      } catch (error) {
        console.error(`Error loading poster ${fileName}:`, error);
      }
    }
    
    // Reset the form and selection
    resetForm();
    selectedPoster = null;
    
  } catch (error) {
    console.error('Error loading posters:', error);
    showErrorMessage('Failed to load posters. Please try again.');
  }
}

// Update the live preview
function updatePreview() {
  const title = websiteTitleInput.value || 'Website Title';
  const url = websiteUrlInput.value || 'https://example.com';
  const description = websiteDescriptionInput.value || '';
  
  // Update front side preview
  previewTitle.textContent = title;
  previewDescription.textContent = description;
  
  // Update back side preview
  previewBackTitle.textContent = title;
  previewUrl.textContent = url;
  previewBackDescription.textContent = description || 'View this website in a new tab';
  previewOpenBtn.href = url;
  
  // Update favicon if URL is valid
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const faviconUrl = `https://${domain}/favicon.ico`;
    
    // Set both icons
    previewIcon.src = faviconUrl;
    previewIcon.onerror = () => {
      previewIcon.src = 'logos/favicon_io/favicon-32x32.png';
    };
    
    previewBackIcon.src = faviconUrl;
    previewBackIcon.onerror = () => {
      previewBackIcon.src = 'logos/favicon_io/favicon-32x32.png';
    };
  } catch (e) {
    // Invalid URL, use default icon
    previewIcon.src = 'logos/favicon_io/favicon-32x32.png';
    previewBackIcon.src = 'logos/favicon_io/favicon-32x32.png';
  }
}

// Select a poster for editing
function selectPoster(fileName) {
  // Update UI for the selected poster
  document.querySelectorAll('.poster-item').forEach(item => {
    item.classList.remove('selected');
    if (item.dataset.fileName === fileName) {
      item.classList.add('selected');
    }
  });
  
  // Find the poster data
  const poster = postersData.find(p => p.fileName === fileName);
  if (poster) {
    selectedPoster = poster;
    
    // Fill the form with the poster data
    const data = poster.data;
    
    websiteTitleInput.value = data.title || '';
    websiteUrlInput.value = data.url || '';
    websiteDescriptionInput.value = data.description || '';
    websiteFilenameInput.value = fileName;
    
    // Handle thumbnail
    if (data.thumbnail && data.thumbnail !== 'path/to/optional/thumbnail.png') {
      websiteThumbnailInput.value = data.thumbnail;
      displayThumbnail(data.thumbnail);
    } else {
      clearThumbnail();
    }
    
    // Update the preview
    updatePreview();
    
    // Switch to edit mode
    editMode = 'edit';
    deletePosterBtn.disabled = false;
  }
}

// Create a new poster
function createNewPoster() {
  resetForm();
  
  // Set defaults
  editMode = 'create';
  deletePosterBtn.disabled = true;
  
  // Remove selection from all posters
  document.querySelectorAll('.poster-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  selectedPoster = null;
  
  // Set focus on the title input
  websiteTitleInput.focus();
  
  // Update the preview
  updatePreview();
}

// Reset the form
function resetForm() {
  editorForm.reset();
  clearThumbnail();
  updatePreview();
}

// Cancel editing
function cancelEdit() {
  resetForm();
  
  // Remove selection from all posters
  document.querySelectorAll('.poster-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  selectedPoster = null;
  editMode = 'create';
  deletePosterBtn.disabled = true;
}

// Toggle the preview flip
function togglePreviewFlip() {
  previewPoster.classList.toggle('flipped');
}

// Save the website poster
async function saveWebsitePoster(event) {
  event.preventDefault();
  
  try {
    // Get form data
    const formData = new FormData(editorForm);
    const title = formData.get('title');
    const url = formData.get('url');
    const description = formData.get('description');
    const thumbnail = formData.get('thumbnail');
    
    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      throw new Error('Please enter a valid URL (e.g., https://example.com)');
    }
    
    // Create poster data object
    const posterData = {
      type: 'website',
      title: title,
      url: url
    };
    
    // Add optional fields if they have values
    if (description) {
      posterData.description = description;
    }
    
    if (thumbnail) {
      posterData.thumbnail = thumbnail;
    }
    
    // Determine filename for new posters
    let filename = formData.get('filename');
    if (!filename || editMode === 'create') {
      // Create a filename from the title
      filename = title
        .replace(/[^a-zA-Z0-9_]/g, '_') // Replace non-alphanumeric chars with underscores
        .replace(/_+/g, '_')            // Replace multiple underscores with a single one
        .replace(/^_|_$/g, '')          // Remove leading/trailing underscores
        + '.json';
    }
    
    // Get the directory to save to
    const saveDirectory = currentDirectory;
    
    // Create the full path
    const savePath = `${saveDirectory}/${filename}`;
    
    // Save the file
    const response = await fetch('/api/save-poster', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: savePath,
        data: posterData
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    // Show success message
    alert(`Website poster "${title}" saved successfully!`);
    
    // Reload posters from directory
    await loadPostersFromDirectory();
    
    // Select the saved poster
    selectPoster(filename);
    
  } catch (error) {
    console.error('Error saving poster:', error);
    showErrorMessage(error.message || 'Failed to save poster. Please try again.');
  }
}

// Delete the selected poster
async function deletePoster() {
  if (!selectedPoster) {
    return;
  }
  
  try {
    const response = await fetch('/api/delete-poster', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: selectedPoster.filePath
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    // Show success message
    alert(`Poster deleted successfully!`);
    
    // Reload posters from directory
    await loadPostersFromDirectory();
    
  } catch (error) {
    console.error('Error deleting poster:', error);
    showErrorMessage('Failed to delete poster. Please try again.');
  }
}

// Show delete confirmation dialog
function showDeleteConfirmation() {
  if (!selectedPoster) return;
  
  const posterTitle = selectedPoster.data.title || 'this poster';
  dialogMessage.textContent = `Are you sure you want to delete "${posterTitle}"?`;
  
  pendingAction = deletePoster;
  showConfirmationDialog();
}

// Show confirmation dialog
function showConfirmationDialog() {
  confirmationDialog.style.display = 'flex';
}

// Hide confirmation dialog
function hideConfirmationDialog() {
  confirmationDialog.style.display = 'none';
}

// Confirm pending action
function confirmAction() {
  hideConfirmationDialog();
  if (pendingAction) {
    pendingAction();
    pendingAction = null;
  }
}

// Cancel pending action
function cancelAction() {
  hideConfirmationDialog();
  pendingAction = null;
}

// Show new directory dialog
function showNewDirectoryDialog() {
  newDirectoryNameInput.value = '';
  newDirectoryDialog.style.display = 'flex';
}

// Hide new directory dialog
function hideNewDirectoryDialog() {
  newDirectoryDialog.style.display = 'none';
}

// Create a new directory
async function createNewDirectory() {
  const directoryName = newDirectoryNameInput.value.trim();
  
  if (!directoryName) {
    alert('Please enter a directory name');
    return;
  }
  
  try {
    const response = await fetch('/api/create-directory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: directoryName
      })
    });
    
    // Check for valid response type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server returned non-JSON response. Please try again.');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create directory');
    }
    
    // Close the dialog
    hideNewDirectoryDialog();
    
    // Add the new directory to the select options
    const option = document.createElement('option');
    option.value = data.path;
    option.textContent = directoryName;
    directoryChooser.appendChild(option);
    
    // Select the new directory
    directoryChooser.value = data.path;
    loadPostersFromDirectory();
    
    // Show success message
    alert(`Category "${directoryName}" created successfully!`);
    
  } catch (error) {
    console.error('Error creating directory:', error);
    showErrorMessage(error.message || 'Failed to create directory. Please try again.');
  }
}

// Open the image selector for thumbnail
function openImageSelector() {
  // Create a file input element
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // For simplicity, we'll just display the local image in the preview
    // In a real app, you'd upload this file to the server and get a URL back
    
    // Display the thumbnail preview
    const reader = new FileReader();
    reader.onload = (e) => {
      // Simulate path - in a real app, this would be the path after upload
      const thumbnailPath = `images/${file.name}`;
      websiteThumbnailInput.value = thumbnailPath;
      displayThumbnail(URL.createObjectURL(file));
      
      // Show clear button
      thumbnailClearBtn.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  };
  
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

// Display a thumbnail in the preview
function displayThumbnail(src) {
  thumbnailPreview.innerHTML = `<img src="${src}" alt="Thumbnail Preview">`;
  thumbnailClearBtn.style.display = 'inline-block';
}

// Clear the thumbnail
function clearThumbnail() {
  thumbnailPreview.innerHTML = '';
  websiteThumbnailInput.value = '';
  thumbnailClearBtn.style.display = 'none';
}

// Show error message
function showErrorMessage(message) {
  alert(`Error: ${message}`);
} 
