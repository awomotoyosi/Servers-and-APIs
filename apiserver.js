// apiServer.js
// This server manages inventory information using a local JSON file for persistence.

const http = require('http');     // Node.js built-in HTTP module
const fs = require('fs');         // Node.js built-in File System module
const path = require('path');     // Node.js built-in Path module
const { randomUUID } = require('crypto'); // For generating unique IDs (Node.js 14.17.0+ for randomUUID)

const API_PORT = 800; // Define the port for the API server
const ITEMS_FILE = path.join(__dirname, 'items.json'); // Path to the JSON file for storing items

// --- Utility Functions for File System Persistence ---

/**
 * Reads inventory items from the items.json file.
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of items.
 */
async function readItems() {
    try {
        // Check if the file exists. If not, return an empty array.
        if (!fs.existsSync(ITEMS_FILE)) {
            console.log(`Creating empty ${ITEMS_FILE} as it does not exist.`);
            await fs.promises.writeFile(ITEMS_FILE, '[]', 'utf8');
            return [];
        }
        // Read the file content
        const data = await fs.promises.readFile(ITEMS_FILE, 'utf8');
        // Parse the JSON data. Handle cases where the file might be empty or malformed.
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading items file:', error.message); // Log specific error message
        // If there's a parsing error, it's safer to return an empty array
        // to prevent application crashes due0 to bad data.
        return [];
    }
}

/**
 * Writes inventory items to the items.json file.
 * @param {Array<Object>} items - The array of items to write.
 * @returns {Promise<void>} A promise that resolves when the items are written.
 */
async function writeItems(items) {
    try {
        // Stringify the items array with pretty printing (2 spaces)
        await fs.promises.writeFile(ITEMS_FILE, JSON.stringify(items, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing items file:', error.message); // Log specific error message
        throw new Error('Failed to persist items.');
    }
}

// --- API Response Helper Function ---

/**
 * Sends a consistent JSON response for API calls.
 * @param {ServerResponse} res - The HTTP response object.
 * @param {number} statusCode - The HTTP status code (e.g., 200, 201, 400, 404, 500).
 * @param {boolean} success - Indicates if the operation was successful.
 * @param {string} message - A descriptive message for the response.
 * @param {Object|Array|null} [data=null] - The actual data payload (e.g., item object, array of items).
 */
function sendJsonResponse(res, statusCode, success, message, data = null) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success, message, data }));
}

// --- API Endpoints Handlers ---

/**
 * Handles GET /items - Get all items.
 */
async function handleGetAllItems(req, res) {
    try {
        const items = await readItems();
        sendJsonResponse(res, 200, true, 'Successfully retrieved all items.', items);
    } catch (error) {
        console.error('Error in handleGetAllItems:', error.message);
        sendJsonResponse(res, 500, false, 'Internal server error while retrieving items.', null);
    }
}

/**
 * Handles GET /items/:id - Get a single item by ID.
 * @param {string} itemId - The ID of the item to retrieve.
 */
async function handleGetOneItem(req, res, itemId) {
    try {
        const items = await readItems();
        const item = items.find(i => i.id === itemId);
        if (item) {
            sendJsonResponse(res, 200, true, 'Successfully retrieved item.', item);
        } else {
            sendJsonResponse(res, 404, false, `Item with ID ${itemId} not found.`, null);
        }
    } catch (error) {
        console.error('Error in handleGetOneItem:', error.message);
        sendJsonResponse(res, 500, false, 'Internal server error while retrieving item.', null);
    }
}

/**
 * Handles POST /items - Create a new item.
 */
async function handleCreateItem(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // Convert buffer to string
    });
    req.on('end', async () => {
        try {
            const newItemData = JSON.parse(body);
            console.log('Parsed new item data:', newItemData); // Log parsed data

            // Validate required attributes
            if (!newItemData.name || !newItemData.price || !newItemData.size) {
                sendJsonResponse(res, 400, false, 'Missing required fields: name, price, and size are mandatory.', null);
                return;
            }

            // Validate size
            const validSizes = ['s', 'm', 'l'];
            if (!validSizes.includes(newItemData.size.toLowerCase())) {
                sendJsonResponse(res, 400, false, `Invalid size '${newItemData.size}'. Must be 's', 'm', or 'l'.`, null);
                return;
            }

            // Validate price is a number
            if (isNaN(parseFloat(newItemData.price)) || !isFinite(newItemData.price)) {
                sendJsonResponse(res, 400, false, 'Price must be a valid number.', null);
                return;
            }

            const items = await readItems();
            console.log('Current items after reading:', items); // Log current items
            const newItem = {
                id: randomUUID(), // Generate a unique ID for the new item
                name: newItemData.name,
                price: parseFloat(newItemData.price), // Ensure price is a number
                size: newItemData.size.toLowerCase() // Ensure size is lowercase
            };
            items.push(newItem); // Add new item to the array
            await writeItems(items); // Persist the updated array
            sendJsonResponse(res, 201, true, 'Item created successfully.', newItem);
        } catch (error) {
            // Log the detailed error message for debugging
            console.error('Error creating item in handleCreateItem:', error.message);
            if (error instanceof SyntaxError) {
                sendJsonResponse(res, 400, false, 'Invalid JSON format in request body.', null);
            } else {
                sendJsonResponse(res, 500, false, `Internal server error while creating item: ${error.message}`, null);
            }
        }
    });
}

/**
 * Handles PUT /items/:id - Update an existing item.
 * @param {string} itemId - The ID of the item to update.
 */
async function handleUpdateItem(req, res, itemId) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async () => {
        try {
            const updatedItemData = JSON.parse(body);
            let items = await readItems();
            const index = items.findIndex(i => i.id === itemId);

            if (index !== -1) {
                // Update only allowed fields, maintain existing ones if not provided
                items[index].name = updatedItemData.name !== undefined ? updatedItemData.name : items[index].name;
                items[index].price = updatedItemData.price !== undefined ? parseFloat(updatedItemData.price) : items[index].price;
                items[index].size = updatedItemData.size !== undefined ? updatedItemData.size.toLowerCase() : items[index].size;

                // Validate updated size if provided
                if (updatedItemData.size !== undefined) {
                    const validSizes = ['s', 'm', 'l'];
                    if (!validSizes.includes(items[index].size)) {
                        sendJsonResponse(res, 400, false, `Invalid size '${updatedItemData.size}'. Must be 's', 'm', or 'l'.`, null);
                        return;
                    }
                }

                // Validate updated price if provided
                if (updatedItemData.price !== undefined) {
                    if (isNaN(parseFloat(updatedItemData.price)) || !isFinite(updatedItemData.price)) {
                        sendJsonResponse(res, 400, false, 'Price must be a valid number.', null);
                        return;
                    }
                }

                await writeItems(items);
                sendJsonResponse(res, 200, true, 'Item updated successfully.', items[index]);
            } else {
                sendJsonResponse(res, 404, false, `Item with ID ${itemId} not found.`, null);
            }
        } catch (error) {
            console.error('Error updating item in handleUpdateItem:', error.message);
            if (error instanceof SyntaxError) {
                sendJsonResponse(res, 400, false, 'Invalid JSON format in request body.', null);
            } else {
                sendJsonResponse(res, 500, false, `Internal server error while updating item: ${error.message}`, null);
            }
        }
    });
}

/**
 * Handles DELETE /items/:id - Delete an item.
 * @param {string} itemId - The ID of the item to delete.
 */
async function handleDeleteItem(req, res, itemId) {
    try {
        let items = await readItems();
        const initialLength = items.length;
        // Filter out the item to be deleted
        items = items.filter(i => i.id !== itemId);

        if (items.length < initialLength) {
            await writeItems(items);
            sendJsonResponse(res, 200, true, 'Item deleted successfully.', null);
        } else {
            sendJsonResponse(res, 404, false, `Item with ID ${itemId} not found.`, null);
        }
    } catch (error) {
        console.error('Error deleting item in handleDeleteItem:', error.message);
        sendJsonResponse(res, 500, false, `Internal server error while deleting item: ${error.message}`, null);
    }
}

// Create the HTTP server for the API
const apiServer = http.createServer(async (req, res) => {
    // Log the incoming API request
    console.log(`API Server Request: ${req.method} ${req.url}`);

    const [urlBase, itemId] = req.url.split('/').filter(Boolean); // e.g., ['items', '123']

    // Route requests based on URL path and HTTP method
    if (urlBase === 'items') {
        if (req.method === 'GET') {
            if (itemId) {
                await handleGetOneItem(req, res, itemId); // GET /items/:id
            } else {
                await handleGetAllItems(req, res); // GET /items
            }
        } else if (req.method === 'POST' && !itemId) {
            await handleCreateItem(req, res); // POST /items
        } else if (req.method === 'PUT' && itemId) {
            await handleUpdateItem(req, res, itemId); // PUT /items/:id
        } else if (req.method === 'DELETE' && itemId) {
            await handleDeleteItem(req, res, itemId); // DELETE /items/:id
        } else {
            // Method Not Allowed or invalid path for method
            sendJsonResponse(res, 405, false, 'Method Not Allowed or Invalid API Endpoint.', null);
        }
    } else {
        // Not an /items endpoint
        sendJsonResponse(res, 404, false, 'API Endpoint Not Found.', null);
    }
});

// Start the API server and listen on the specified port
apiServer.listen(API_PORT, () => {
    console.log(`API Server running on http://localhost:${API_PORT}`);
    console.log(`
API Usage Examples (using curl or Postman/Insomnia):

1. Get all items:
   GET http://localhost:${API_PORT}/items

2. Create an item:
   POST http://localhost:${API_PORT}/items
   Content-Type: application/json
   Body: {"name": "Laptop", "price": 1200.00, "size": "m"}

3. Get one item (replace <id> with actual item ID from creation):
   GET http://localhost:${API_PORT}/items/<id>

4. Update an item (replace <id>):
   PUT http://localhost:${API_PORT}/items/<id>
   Content-Type: application/json
   Body: {"price": 1150.00, "size": "l"} // Can update partial fields

5. Delete an item (replace <id>):
   DELETE http://localhost:${API_PORT}/items/<id>
`);
});
