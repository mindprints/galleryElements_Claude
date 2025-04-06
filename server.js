const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

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
    const dirPath = path.join(__dirname, 'JSON_Posters');
    const directories = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    res.json(directories);
  } catch (error) {
    console.error('Error getting directories:', error);
    res.status(500).json({ error: 'Failed to get directories' });
  }
});

// Get posters from a directory
app.get('/api/posters', (req, res) => {
  try {
    const { directory } = req.query;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory parameter is required' });
    }
    
    const dirPath = path.join(__dirname, directory);
    
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    // Get all files in the directory
    const files = fs.readdirSync(dirPath);
    
    res.json(files);
  } catch (error) {
    console.error('Error getting posters:', error);
    res.status(500).json({ error: 'Failed to get posters' });
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

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 