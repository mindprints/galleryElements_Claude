// journey-editor.js - JavaScript for journey editor functionality

// DOM Elements
const directoryFilter = document.getElementById('directory-filter');
const posterSearch = document.getElementById('poster-search');
const availablePostersList = document.getElementById('available-posters-list');
const selectedPostersList = document.getElementById('selected-posters-list');
const journeyForm = document.getElementById('journey-editor-form');
const journeyName = document.getElementById('journey-name');
const journeyDescription = document.getElementById('journey-description');
const journeyFilename = document.getElementById('journey-filename');
const journeyChooser = document.getElementById('journey-chooser');
const deleteJourneyBtn = document.getElementById('delete-journey-btn');
const newJourneyBtn = document.getElementById('new-journey-btn');
const confirmationDialog = document.getElementById('confirmation-dialog');
const dialogMessage = document.getElementById('dialog-message');
const dialogConfirmBtn = document.getElementById('dialog-confirm');
const dialogCancelBtn = document.getElementById('dialog-cancel');

// Global variables
let allPosters = [];
let filteredPosters = [];
let selectedPosters = [];
let currentJourney = null;
let dialogCallback = null;

// Utility function to extract filename from path
function getFilenameFromPath(path) {
  return path.split('/').pop();
}

// Initialize the editor
document.addEventListener('DOMContentLoaded', async () => {
  // Load all directories for the filter
  await loadDirectories();
  
  // Load all posters
  await loadAllPosters();
  
  // Load all journeys for the chooser
  await loadJourneys();
  
  // Set up event listeners
  setUpEventListeners();
  
  // Start with a new journey
  createNewJourney();
});

// Load all directories for the filter dropdown
async function loadDirectories() {
  try {
    const response = await fetch('/api/directories');
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const directories = await response.json();
    
    // Add each directory to the filter dropdown
    directories.forEach(directory => {
      const option = document.createElement('option');
      option.value = `JSON_Posters/${directory}`;
      
      // Format the display name (convert camelCase or snake_case to Title Case)
      let displayName = directory
        .replace(/([A-Z])/g, ' $1') // Convert camelCase to spaces
        .replace(/_/g, ' ')         // Convert snake_case to spaces
        .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
        
      option.textContent = displayName;
      directoryFilter.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading directories:', error);
    showError('Failed to load directories. Please try refreshing the page.');
  }
}

// Load all posters from all directories
async function loadAllPosters() {
  try {
    const response = await fetch('/api/all-posters');
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    allPosters = await response.json();

    // Ensure each poster object has a filename property
    allPosters = allPosters.map(poster => ({
      ...poster,
      filename: poster.filename || getFilenameFromPath(poster.path)
    }));
    
    // Initial filter of posters (show all by default)
    filterPosters();
  } catch (error) {
    console.error('Error loading posters:', error);
    showError('Failed to load posters. Please try refreshing the page.');
  }
}

// Filter posters based on directory and search criteria
function filterPosters() {
  const directoryValue = directoryFilter.value;
  const searchValue = posterSearch.value.toLowerCase();
  
  // Filter posters by directory and search terms
  filteredPosters = allPosters.filter(poster => {
    // Check directory filter
    if (directoryValue !== 'all' && !poster.directory.startsWith(directoryValue)) {
      return false;
    }
    
    // Check search filter
    if (searchValue && !poster.title.toLowerCase().includes(searchValue)) {
      return false;
    }
    
    return true;
  });
  
  // Update the available posters list
  updateAvailablePostersList();
}

// Update the available posters list with filtered posters
function updateAvailablePostersList() {
  availablePostersList.innerHTML = '';
  
  if (filteredPosters.length === 0) {
    availablePostersList.innerHTML = '<div class="empty-list-message">No posters found matching your criteria.</div>';
    return;
  }
  
  filteredPosters.forEach(poster => {
    // Create poster item
    const posterItem = document.createElement('div');
    posterItem.className = 'poster-item';
    posterItem.dataset.filename = poster.filename; // Use filename as identifier
    
    // Create thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'poster-thumbnail';
    
    if (poster.thumbnail) {
      const img = document.createElement('img');
      img.src = poster.thumbnail;
      img.alt = poster.title;
      thumbnail.appendChild(img);
    } else {
      thumbnail.classList.add('no-thumbnail');
      thumbnail.textContent = poster.type.charAt(0).toUpperCase();
    }
    
    // Create poster info
    const posterInfo = document.createElement('div');
    posterInfo.className = 'poster-info';
    
    const title = document.createElement('div');
    title.className = 'poster-title';
    title.textContent = poster.title;
    
    const path = document.createElement('div');
    path.className = 'poster-path';
    path.textContent = poster.path; // Display full path for context
    
    posterInfo.appendChild(title);
    posterInfo.appendChild(path);
    
    // Create add button
    const addBtn = document.createElement('button');
    addBtn.className = 'poster-action-btn add-btn';
    addBtn.innerHTML = '&#43;'; // Plus sign
    addBtn.title = 'Add to journey';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addPosterToJourney(poster);
    });
    
    // Add all elements to the poster item
    posterItem.appendChild(thumbnail);
    posterItem.appendChild(posterInfo);
    posterItem.appendChild(addBtn);
    
    // Add poster item to the list
    availablePostersList.appendChild(posterItem);
  });
}

// Add a poster to the selected journey
function addPosterToJourney(poster) {
  // Check if poster is already in the journey using filename
  if (selectedPosters.some(p => p.filename === poster.filename)) {
    showError('This poster is already in the journey.');
    return; // Skip if already added
  }
  
  // Add poster to selected posters array
  selectedPosters.push(poster);
  
  // Update the selected posters list
  updateSelectedPostersList();
}

// Update the selected posters list
function updateSelectedPostersList() {
  selectedPostersList.innerHTML = '';
  
  if (selectedPosters.length === 0) {
    selectedPostersList.innerHTML = '<div class="empty-list-message">No posters selected yet. Add posters from the left panel.</div>';
    return;
  }
  
  selectedPosters.forEach((poster, index) => {
    // Create poster item
    const posterItem = document.createElement('div');
    posterItem.className = 'poster-item';
    posterItem.dataset.filename = poster.filename; // Use filename as identifier
    posterItem.draggable = true;
    
    // Add drag and drop functionality
    posterItem.addEventListener('dragstart', handleDragStart);
    posterItem.addEventListener('dragover', handleDragOver);
    posterItem.addEventListener('dragenter', handleDragEnter);
    posterItem.addEventListener('dragleave', handleDragLeave);
    posterItem.addEventListener('drop', handleDrop);
    posterItem.addEventListener('dragend', handleDragEnd);
    
    // Create reorder handle
    const reorderHandle = document.createElement('div');
    reorderHandle.className = 'reorder-handle';
    reorderHandle.innerHTML = '&#8942;'; // Three vertical dots
    
    // Create thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'poster-thumbnail';
    
    if (poster.thumbnail) {
      const img = document.createElement('img');
      img.src = poster.thumbnail;
      img.alt = poster.title;
      thumbnail.appendChild(img);
    } else {
      thumbnail.classList.add('no-thumbnail');
      thumbnail.textContent = poster.type.charAt(0).toUpperCase();
    }
    
    // Create poster info
    const posterInfo = document.createElement('div');
    posterInfo.className = 'poster-info';
    
    const title = document.createElement('div');
    title.className = 'poster-title';
    title.textContent = poster.title;
    
    const path = document.createElement('div');
    path.className = 'poster-path';
    path.textContent = poster.path; // Display full path for context
    
    posterInfo.appendChild(title);
    posterInfo.appendChild(path);
    
    // Create action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'poster-actions';
    
    // Move up button
    if (index > 0) {
      const moveUpBtn = document.createElement('button');
      moveUpBtn.className = 'poster-action-btn move-up-btn';
      moveUpBtn.innerHTML = '&#8593;'; // Up arrow
      moveUpBtn.title = 'Move up';
      moveUpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveSelectedPoster(index, index - 1);
      });
      actionsDiv.appendChild(moveUpBtn);
    }
    
    // Move down button
    if (index < selectedPosters.length - 1) {
      const moveDownBtn = document.createElement('button');
      moveDownBtn.className = 'poster-action-btn move-down-btn';
      moveDownBtn.innerHTML = '&#8595;'; // Down arrow
      moveDownBtn.title = 'Move down';
      moveDownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveSelectedPoster(index, index + 1);
      });
      actionsDiv.appendChild(moveDownBtn);
    }
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'poster-action-btn remove-btn';
    removeBtn.innerHTML = '&#10005;'; // Cross mark
    removeBtn.title = 'Remove from journey';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeSelectedPoster(index);
    });
    actionsDiv.appendChild(removeBtn);
    
    // Add all elements to the poster item
    posterItem.appendChild(reorderHandle);
    posterItem.appendChild(thumbnail);
    posterItem.appendChild(posterInfo);
    posterItem.appendChild(actionsDiv);
    
    // Add poster item to the list
    selectedPostersList.appendChild(posterItem);
  });
}

// Move a selected poster up or down in the list
function moveSelectedPoster(fromIndex, toIndex) {
  // Ensure indices are valid
  if (fromIndex < 0 || fromIndex >= selectedPosters.length || toIndex < 0 || toIndex >= selectedPosters.length) {
    return;
  }
  
  // Move the poster in the array
  const [movedPoster] = selectedPosters.splice(fromIndex, 1);
  selectedPosters.splice(toIndex, 0, movedPoster);
  
  // Update the UI
  updateSelectedPostersList();
}

// Remove a selected poster from the journey
function removeSelectedPoster(index) {
  // Ensure index is valid
  if (index < 0 || index >= selectedPosters.length) {
    return;
  }
  
  // Remove the poster from the array
  selectedPosters.splice(index, 1);
  
  // Update the UI
  updateSelectedPostersList();
}

// Load all journeys
async function loadJourneys() {
  try {
    const response = await fetch('/api/journeys');
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const journeys = await response.json();
    
    // Clear existing options
    journeyChooser.innerHTML = '<option value="">-- Select a Journey --</option>';
    
    // Add each journey to the dropdown
    journeys.forEach(journey => {
      const option = document.createElement('option');
      option.value = journey.filename;
      option.textContent = journey.name;
      journeyChooser.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading journeys:', error);
    showError('Failed to load journeys. Please try refreshing the page.');
  }
}

// Load a specific journey
async function loadJourney(journeyFilename) {
  try {
    const response = await fetch(`/api/journey/${journeyFilename}`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const journeyData = await response.json();
    
    // Update the current journey
    currentJourney = journeyData;
    
    // Update the form
    journeyName.value = journeyData.name || '';
    journeyDescription.value = journeyData.description || '';
    journeyFilename.value = journeyFilename;
    
    // Clear selected posters
    selectedPosters = [];
    
    // Add each poster from the journey to the selected posters
    if (journeyData.posters && journeyData.posters.length > 0) {
      for (const posterInfo of journeyData.posters) {
        // Find the poster in the allPosters array using filename
        const poster = allPosters.find(p => p.filename === posterInfo.filename);
        if (poster) {
          selectedPosters.push(poster);
        } else {
          // If poster is not found in allPosters, use the info from the journey
          // Ensure this fallback object has the necessary properties
          console.warn(`Poster with filename ${posterInfo.filename} not found in available posters. Using data from journey file.`);
          selectedPosters.push({
            filename: posterInfo.filename,
            title: posterInfo.title || 'Unknown Title',
            type: posterInfo.type || 'unknown',
            path: posterInfo.path || `Unknown path for ${posterInfo.filename}`, // Keep path for display consistency
            thumbnail: posterInfo.thumbnail
          });
        }
      }
    }
    
    // Update the UI
    updateSelectedPostersList();
  } catch (error) {
    console.error('Error loading journey:', error);
    showError('Failed to load journey. Please try refreshing the page.');
  }
}

// Create a new journey
function createNewJourney() {
  // Reset the form
  journeyName.value = '';
  journeyDescription.value = '';
  journeyFilename.value = '';
  
  // Clear selected posters
  selectedPosters = [];
  
  // Reset the current journey
  currentJourney = null;
  
  // Clear the journey chooser selection
  journeyChooser.value = '';
  
  // Update the UI
  updateSelectedPostersList();
}

// Save the current journey
async function saveJourney(event) {
  // Prevent form submission
  if (event) event.preventDefault();
  
  // Validate form
  if (!journeyName.value.trim()) {
    showError('Please enter a journey name.');
    return;
  }
  
  if (selectedPosters.length === 0) {
    showError('Please add at least one poster to the journey.');
    return;
  }
  
  // Prepare journey data, saving only essential info and using filename
  const journeyData = {
    name: journeyName.value.trim(),
    description: journeyDescription.value.trim(),
    posters: selectedPosters.map(poster => ({
      filename: poster.filename, // Use filename as the identifier
      type: poster.type,         // Include type
      title: poster.title,       // Include title
      thumbnail: poster.thumbnail  // Include thumbnail path
    }))
  };
  
  // Get or generate filename for the journey file itself
  let filename = journeyFilename.value;
  if (!filename) {
    // Generate filename from journey name
    filename = journeyData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.json';
    journeyFilename.value = filename;
  }
  
  try {
    // Save the journey
    const response = await fetch('/api/save-journey', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename, // Filename of the journey file
        data: journeyData // The actual journey data
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server returned ${response.status}`);
    }
    
    // Update current journey
    currentJourney = journeyData;
    
    // Reload journeys list
    await loadJourneys();
    
    // Select the saved journey in the dropdown
    journeyChooser.value = filename;
    
    // Show success message
    alert('Journey saved successfully!');
  } catch (error) {
    console.error('Error saving journey:', error);
    showError(`Failed to save journey: ${error.message}`);
  }
}

// Delete the current journey
function deleteJourney() {
  const filename = journeyFilename.value;
  
  if (!filename) {
    showError('No journey selected to delete.');
    return;
  }
  
  // Show confirmation dialog
  showConfirmationDialog(
    `Are you sure you want to delete the journey "${journeyName.value || 'Unnamed'}"? This action cannot be undone.`,
    async () => {
      try {
        // Delete the journey
        const response = await fetch('/api/delete-journey', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ filename })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server returned ${response.status}`);
        }
        
        // Create a new journey
        createNewJourney();
        
        // Reload journeys list
        await loadJourneys();
        
        // Show success message
        alert('Journey deleted successfully!');
      } catch (error) {
        console.error('Error deleting journey:', error);
        showError(`Failed to delete journey: ${error.message}`);
      }
    }
  );
}

// Show confirmation dialog
function showConfirmationDialog(message, onConfirm) {
  dialogMessage.textContent = message;
  dialogCallback = onConfirm;
  confirmationDialog.style.display = 'flex';
}

// Hide confirmation dialog
function hideConfirmationDialog() {
  confirmationDialog.style.display = 'none';
  dialogCallback = null;
}

// Show error message
function showError(message) {
  alert(message);
}

// Set up event listeners
function setUpEventListeners() {
  // Directory filter change
  directoryFilter.addEventListener('change', filterPosters);
  
  // Search input
  posterSearch.addEventListener('input', filterPosters);
  
  // Journey form submission
  journeyForm.addEventListener('submit', saveJourney);
  
  // Delete journey button
  deleteJourneyBtn.addEventListener('click', deleteJourney);
  
  // New journey button
  newJourneyBtn.addEventListener('click', createNewJourney);
  
  // Journey chooser change
  journeyChooser.addEventListener('change', (event) => {
    const filename = event.target.value;
    if (filename) {
      loadJourney(filename);
    } else {
      createNewJourney();
    }
  });
  
  // Confirmation dialog buttons
  dialogConfirmBtn.addEventListener('click', () => {
    if (dialogCallback) dialogCallback();
    hideConfirmationDialog();
  });
  
  dialogCancelBtn.addEventListener('click', hideConfirmationDialog);
}

// Drag and drop functions
let draggedItem = null;

function handleDragStart(e) {
  draggedItem = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.filename); // Use filename for transfer data
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  this.classList.add('drag-over');
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.stopPropagation();
  
  if (draggedItem !== this) {
    // Get the indices
    const items = Array.from(selectedPostersList.querySelectorAll('.poster-item'));
    const fromIndex = items.indexOf(draggedItem);
    const toIndex = items.indexOf(this);
    
    // Move the poster in the selectedPosters array
    moveSelectedPoster(fromIndex, toIndex);
  }
  
  return false;
}

function handleDragEnd(e) {
  // Remove dragging and drag-over classes
  const items = document.querySelectorAll('.poster-item');
  items.forEach(item => {
    item.classList.remove('dragging');
    item.classList.remove('drag-over');
  });
  
  draggedItem = null;
} 