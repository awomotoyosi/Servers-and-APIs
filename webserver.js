// webServer.js
// This server handles serving static HTML files.

const http = require('http'); // Node.js built-in HTTP module
const fs = require('fs');     // Node.js built-in File System module
const path = require('path'); // Node.js built-in Path module for handling file paths

const PORT = 3000; // Define the port for the web server

// Function to serve a file or handle 404
function serveFile(res, filePath, contentType, statusCode = 200) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            // If there's an error reading the file (e.g., file not found),
            // log the error and serve the 404 page.
            console.error(`Error reading file ${filePath}:`, err);
            serve404Page(res);
            return;
        }
        // Set the appropriate Content-Type header
        res.writeHead(statusCode, { 'Content-Type': contentType });
        // Send the file content as the response body
        res.end(data);
    });
}

// Function to serve the 404 Not Found page
function serve404Page(res) {
    const notFoundPath = path.join(__dirname, '404.html');
    fs.readFile(notFoundPath, (err, data) => {
        if (err) {
            // Fallback in case 404.html itself cannot be read
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error: 404 page not found.');
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(data);
    });
}

// Create the HTTP server
const webServer = http.createServer((req, res) => {
    // Log the incoming request URL
    console.log(`Web Server Request: ${req.method} ${req.url}`);

    // Normalize the URL path for consistent handling
    const urlPath = req.url === '/' ? '/index.html' : req.url;

    // Check if the request is for '/index.html'
    if (urlPath === '/index.html') {
        const filePath = path.join(__dirname, 'index.html');
        serveFile(res, filePath, 'text/html');
    }
    // Check if the request ends with '.html' but is not '/index.html'
    else if (urlPath.endsWith('.html')) {
        // This covers cases like '/random.html'
        serve404Page(res);
    }
    // For any other requests (e.g., favicon.ico, or non-HTML paths), serve 404
    else {
        serve404Page(res);
    }
});

// Start the web server and listen on the specified port
webServer.listen(PORT, () => {
    console.log(`Web Server running on http://localhost:${PORT}`);
    console.log('Navigate to http://localhost:3000/index.html to see the student page.');
    console.log('Try http://localhost:3000/random.html for a 404 page.');
});

