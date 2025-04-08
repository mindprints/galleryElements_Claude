const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;

// Set up multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Add error handler for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

// Set static files with caching headers
app.use(express.static('./', {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // No caching for HTML files
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.endsWith('.js') || path.endsWith('.css')) {
      // Cache JS and CSS for 1 hour
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Get all JSON_Posters subdirectories
app.get('/api/directories', (req, res) => {
  try {
    console.log("Getting directories. Current directory:", __dirname);
    const dirPath = path.join(__dirname, 'JSON_Posters');
    console.log("Looking for directories in:", dirPath);
    
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      console.error("JSON_Posters directory not found at:", dirPath);
      return res.status(404).json({ error: 'JSON_Posters directory not found' });
    }
    
    const directories = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log("Found directories:", directories);
    res.json(directories);
  } catch (error) {
    console.error('Error getting directories:', error);
    res.status(500).json({ error: 'Failed to get directories: ' + error.message });
  }
});

// Get posters from a directory
app.get('/api/posters', (req, res) => {
  try {
    const { directory } = req.query;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory parameter is required' });
    }
    
    console.log("Getting posters from directory:", directory);
    const dirPath = path.join(__dirname, directory);
    console.log("Full path:", dirPath);
    
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      console.error("Directory not found:", dirPath);
      return res.status(404).json({ error: 'Directory not found: ' + dirPath });
    }
    
    // Get all files in the directory
    const files = fs.readdirSync(dirPath);
    console.log(`Found ${files.length} files in ${directory}`);
    
    res.json(files);
  } catch (error) {
    console.error('Error getting posters:', error);
    res.status(500).json({ error: 'Failed to get posters: ' + error.message });
  }
});

// Save a poster
app.post('/api/save-poster', (req, res) => {
  try {
    const { path: posterPath, data } = req.body;
    
    if (!posterPath || !data) {
      return res.status(400).json({ error: 'Path and data are required' });
    }
    
    const filePath = path.join(__dirname, posterPath);
    
    // Make sure the directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    // Write the file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ success: true, message: 'Poster saved successfully' });
  } catch (error) {
    console.error('Error saving poster:', error);
    res.status(500).json({ error: 'Failed to save poster' });
  }
});

// Save an image file
app.post('/api/save-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const imagePath = req.body.path;
    
    if (!imagePath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const filePath = path.join(__dirname, imagePath);
    
    // Make sure the directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    // Write the file
    fs.writeFileSync(filePath, req.file.buffer);
    
    res.json({ success: true, message: 'Image saved successfully' });
  } catch (error) {
    console.error('Error saving image:', error);
    res.status(500).json({ error: 'Failed to save image' });
  }
});

// Delete a poster
app.post('/api/delete-poster', (req, res) => {
  try {
    const { path: posterPath } = req.body;
    
    if (!posterPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const filePath = path.join(__dirname, posterPath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    res.json({ success: true, message: 'Poster deleted successfully' });
  } catch (error) {
    console.error('Error deleting poster:', error);
    res.status(500).json({ error: 'Failed to delete poster' });
  }
});

// Save a file (primarily for JSON wrappers)
app.post('/api/save-file', upload.single('file'), (req, res) => {
  try {
    console.log("API /save-file called");
    
    if (!req.file) {
      console.error("No file provided in request");
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const filePath = req.body.path;
    console.log("Saving file to path:", filePath);
    
    if (!filePath) {
      console.error("No path provided in request");
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const fullPath = path.join(__dirname, filePath);
    
    // Make sure the directory exists
    const dirPath = path.dirname(fullPath);
    if (!fs.existsSync(dirPath)) {
      console.error("Directory not found:", dirPath);
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    // Log file content for debugging (for text files only)
    if (req.file.mimetype.includes('text') || req.file.mimetype.includes('json')) {
      console.log("File content:", req.file.buffer.toString('utf8').substring(0, 500));
    }
    
    // Write the file
    fs.writeFileSync(fullPath, req.file.buffer);
    console.log("File saved successfully to:", fullPath);
    
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Create a new directory in JSON_Posters
app.post('/api/create-directory', (req, res) => {
  try {
    // First ensure we have a valid request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Directory name is required and must be a string' });
    }
    
    // Sanitize directory name
    const sanitizedName = name
      .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace invalid chars with underscore
      .replace(/_{2,}/g, '_')          // Replace multiple underscores with single
      .replace(/^_|_$/g, '');          // Remove leading/trailing underscores
    
    if (!sanitizedName) {
      return res.status(400).json({ error: 'Invalid directory name after sanitization' });
    }
    
    const dirPath = path.join(__dirname, 'JSON_Posters', sanitizedName);
    
    // Check if directory already exists
    if (fs.existsSync(dirPath)) {
      return res.status(409).json({ error: 'Directory already exists' });
    }
    
    // Create the directory
    fs.mkdirSync(dirPath, { recursive: true });
    
    res.json({ 
      success: true, 
      message: 'Directory created successfully',
      path: `JSON_Posters/${sanitizedName}`
    });
  } catch (error) {
    console.error('Error creating directory:', error);
    res.status(500).json({ error: 'Failed to create directory: ' + error.message });
  }
});

// Check if a directory exists
app.post('/api/check-directory', (req, res) => {
  try {
    const { path: dirPath } = req.body;
    
    if (!dirPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const fullPath = path.join(__dirname, dirPath);
    const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    
    res.json({ exists });
  } catch (error) {
    console.error('Error checking directory:', error);
    res.status(500).json({ error: 'Failed to check directory: ' + error.message });
  }
});

// Create an images directory within a specified path
app.post('/api/create-images-directory', (req, res) => {
  try {
    const { path: dirPath } = req.body;
    
    if (!dirPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const fullPath = path.join(__dirname, dirPath);
    
    // Create the directory
    fs.mkdirSync(fullPath, { recursive: true });
    
    res.json({ 
      success: true, 
      message: 'Images directory created successfully',
      path: dirPath
    });
  } catch (error) {
    console.error('Error creating images directory:', error);
    res.status(500).json({ error: 'Failed to create images directory: ' + error.message });
  }
});

// Get all journeys
app.get('/api/journeys', (req, res) => {
  try {
    const journeysDir = path.join(__dirname, 'JSON_Posters/Journeys');
    
    // Check if directory exists, create if not
    if (!fs.existsSync(journeysDir)) {
      fs.mkdirSync(journeysDir, { recursive: true });
    }
    
    // Get all files in the journeys directory
    const files = fs.readdirSync(journeysDir)
      .filter(file => file.endsWith('.json'));
    
    // Read each journey file to get its name and description
    const journeys = files.map(file => {
      try {
        const filePath = path.join(journeysDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          filename: file,
          name: data.name || 'Unnamed Journey',
          description: data.description || '',
          posterCount: data.posters ? data.posters.length : 0,
          dateModified: data.dateModified || ''
        };
      } catch (error) {
        console.error(`Error reading journey file ${file}:`, error);
        return {
          filename: file,
          name: 'Error: Invalid Journey File',
          description: '',
          posterCount: 0,
          dateModified: ''
        };
      }
    });
    
    res.json(journeys);
  } catch (error) {
    console.error('Error getting journeys:', error);
    res.status(500).json({ error: 'Failed to get journeys: ' + error.message });
  }
});

// Get a single journey by filename
app.get('/api/journey/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename parameter is required' });
    }
    
    const filePath = path.join(__dirname, 'JSON_Posters/Journeys', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Journey file not found' });
    }
    
    // Read the journey file
    const journeyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    res.json(journeyData);
  } catch (error) {
    console.error('Error getting journey:', error);
    res.status(500).json({ error: 'Failed to get journey: ' + error.message });
  }
});

// Save a journey
app.post('/api/save-journey', (req, res) => {
  try {
    const { filename, data } = req.body;
    
    if (!filename || !data) {
      return res.status(400).json({ error: 'Filename and data are required' });
    }
    
    // Ensure the data has required fields
    if (!data.name || !Array.isArray(data.posters)) {
      return res.status(400).json({ error: 'Journey must have a name and posters array' });
    }
    
    // Add timestamps if not present
    if (!data.dateCreated) {
      data.dateCreated = new Date().toISOString();
    }
    data.dateModified = new Date().toISOString();
    
    const journeysDir = path.join(__dirname, 'JSON_Posters/Journeys');
    
    // Check if directory exists, create if not
    if (!fs.existsSync(journeysDir)) {
      fs.mkdirSync(journeysDir, { recursive: true });
    }
    
    const filePath = path.join(journeysDir, filename);
    
    // Write the file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ success: true, message: 'Journey saved successfully' });
  } catch (error) {
    console.error('Error saving journey:', error);
    res.status(500).json({ error: 'Failed to save journey: ' + error.message });
  }
});

// Delete a journey
app.post('/api/delete-journey', (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    const filePath = path.join(__dirname, 'JSON_Posters/Journeys', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Journey file not found' });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    res.json({ success: true, message: 'Journey deleted successfully' });
  } catch (error) {
    console.error('Error deleting journey:', error);
    res.status(500).json({ error: 'Failed to delete journey: ' + error.message });
  }
});

// Get all posters from all categories
app.get('/api/all-posters', async (req, res) => {
  try {
    // Get all directories in JSON_Posters
    const dirPath = path.join(__dirname, 'JSON_Posters');
    const directories = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .filter(dirent => dirent.name !== 'Journeys') // Exclude Journeys directory
      .map(dirent => dirent.name);
    
    let allPosters = [];
    
    // For each directory, get all the posters
    for (const directory of directories) {
      const directoryPath = path.join(dirPath, directory);
      const fileList = fs.readdirSync(directoryPath);
      
      // Process JSON files first
      for (const file of fileList.filter(f => f.endsWith('.json'))) {
        try {
          const filePath = path.join(directoryPath, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const fullPath = `JSON_Posters/${directory}/${file}`;
          
          // Determine type and title based on file content
          let type = data.type || 'json';
          let title = '';
          
          if (type === 'json') {
            title = data.figure || 'Untitled';
          } else if (type === 'image') {
            title = data.title || file.replace('.json', '');
          } else if (type === 'website') {
            title = data.title || data.url || 'Untitled Website';
          }
          
          // Construct thumbnail path if it exists
          let thumbnail = '';
          if (type === 'image' && data.imagePath) {
            thumbnail = data.imagePath;
          } else if (data.thumbnail) {
            thumbnail = data.thumbnail;
          }
          
          allPosters.push({
            path: fullPath,
            type,
            title,
            thumbnail,
            directory: `JSON_Posters/${directory}`
          });
        } catch (error) {
          console.error(`Error processing poster ${file}:`, error);
        }
      }
    }
    
    res.json(allPosters);
  } catch (error) {
    console.error('Error getting all posters:', error);
    res.status(500).json({ error: 'Failed to get all posters: ' + error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Current directory: ${__dirname}`);
}); 