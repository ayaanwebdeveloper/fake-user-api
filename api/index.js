const http = require('http');
const { URL } = require('url');
const { faker } = require('@faker-js/faker');

// ---------------------------------------------------------------------------
// Generate 500 users once at startup and cache them in memory.
// ---------------------------------------------------------------------------
const TOTAL_USERS = 500;

console.log(`Generating ${TOTAL_USERS} users…`);
const usersCache = [];
for (let i = 1; i <= TOTAL_USERS; i++) {
    usersCache.push({
        id: i,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        age: faker.number.int({ min: 18, max: 80 }),
        jobTitle: faker.person.jobTitle(),
        city: faker.location.city(),
        isActive: faker.datatype.boolean(),
    });
}
console.log(`${TOTAL_USERS} users cached and ready.`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Send a JSON response.
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {object} body
 */
function sendJSON(res, statusCode, body) {
    const payload = JSON.stringify(body);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
}

/**
 * Send a structured error response.
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {string} message
 * @param {object} [details]
 */
function sendError(res, statusCode, message, details) {
    const body = {
        success: false,
        error: {
            status: statusCode,
            message,
            ...(details ? { details } : {}),
        },
        timestamp: new Date().toISOString(),
    };
    sendJSON(res, statusCode, body);
}

/**
 * Parse and validate all supported query parameters.
 * Returns { params } on success or { error } on validation failure.
 * @param {URLSearchParams} searchParams
 */
function parseQueryParams(searchParams) {
    const errors = [];

    // --- limit ---
    let limit = 20;
    if (searchParams.has('limit')) {
        const raw = searchParams.get('limit');
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 1) {
            errors.push('`limit` must be a positive integer.');
        } else if (parsed > 100) {
            errors.push('`limit` must not exceed 100.');
        } else {
            limit = parsed;
        }
    }

    // --- offset ---
    let offset = 0;
    if (searchParams.has('offset')) {
        const raw = searchParams.get('offset');
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 0) {
            errors.push('`offset` must be a non-negative integer.');
        } else {
            offset = parsed;
        }
    }

    // --- minAge ---
    let minAge = null;
    if (searchParams.has('minAge')) {
        const raw = searchParams.get('minAge');
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 0) {
            errors.push('`minAge` must be a non-negative integer.');
        } else {
            minAge = parsed;
        }
    }

    // --- maxAge ---
    let maxAge = null;
    if (searchParams.has('maxAge')) {
        const raw = searchParams.get('maxAge');
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 0) {
            errors.push('`maxAge` must be a non-negative integer.');
        } else {
            maxAge = parsed;
        }
    }

    if (minAge !== null && maxAge !== null && minAge > maxAge) {
        errors.push('`minAge` must not be greater than `maxAge`.');
    }

    // --- isActive ---
    let isActive = null;
    if (searchParams.has('isActive')) {
        const raw = searchParams.get('isActive').toLowerCase();
        if (raw !== 'true' && raw !== 'false') {
            errors.push('`isActive` must be "true" or "false".');
        } else {
            isActive = raw === 'true';
        }
    }

    // --- search (free-text: firstName, lastName, email) ---
    const search = searchParams.has('search')
        ? searchParams.get('search').trim().toLowerCase()
        : null;

    // --- jobTitle ---
    const jobTitle = searchParams.has('jobTitle')
        ? searchParams.get('jobTitle').trim().toLowerCase()
        : null;

    // --- city ---
    const city = searchParams.has('city')
        ? searchParams.get('city').trim().toLowerCase()
        : null;

    if (errors.length > 0) {
        return { error: errors };
    }

    return { params: { limit, offset, minAge, maxAge, isActive, search, jobTitle, city } };
}

/**
 * Apply all active filters to the cached user list and return the matching subset.
 * @param {object} params  Validated query params from parseQueryParams.
 * @returns {object[]}
 */
function filterUsers(params) {
    const { minAge, maxAge, isActive, search, jobTitle, city } = params;

    return usersCache.filter((user) => {
        if (minAge !== null && user.age < minAge) return false;
        if (maxAge !== null && user.age > maxAge) return false;
        if (isActive !== null && user.isActive !== isActive) return false;
        if (jobTitle && !user.jobTitle.toLowerCase().includes(jobTitle)) return false;
        if (city && !user.city.toLowerCase().includes(city)) return false;
        if (search) {
            const haystack =
                `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function handleRequest(req, res) {
    // CORS headers on every response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Pre-flight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Only GET is supported
    if (req.method !== 'GET') {
        return sendError(res, 405, 'Method not allowed. Use GET.');
    }

    // Parse URL (use a dummy base so URL constructor works with relative paths)
    let parsedURL;
    try {
        parsedURL = new URL(req.url, 'http://localhost');
    } catch {
        return sendError(res, 400, 'Malformed request URL.');
    }

    const pathname = parsedURL.pathname;

    // ------------------------------------------------------------------
    // Route: GET /api/data  — paginated, filterable user list
    // ------------------------------------------------------------------
    if (pathname === '/api/data') {
        const { params, error } = parseQueryParams(parsedURL.searchParams);

        if (error) {
            return sendError(res, 400, 'Invalid query parameters.', error);
        }

        let filtered;
        try {
            filtered = filterUsers(params);
        } catch (err) {
            console.error('Filter error:', err);
            return sendError(res, 500, 'Internal server error while filtering users.');
        }

        const { limit, offset } = params;
        const total = filtered.length;

        if (offset > 0 && offset >= total && total > 0) {
            return sendError(
                res,
                404,
                `Offset ${offset} is out of range. Total matching users: ${total}.`
            );
        }

        const page = filtered.slice(offset, offset + limit);

        return sendJSON(res, 200, {
            success: true,
            data: page,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            },
            timestamp: new Date().toISOString(),
        });
    }

    // ------------------------------------------------------------------
    // Route: GET /  — health / welcome
    // ------------------------------------------------------------------
    if (pathname === '/') {
        return sendJSON(res, 200, {
            success: true,
            message: 'Fake User API is running.',
            endpoints: {
                users: '/api/data',
                queryParams: {
                    search: 'string — search firstName, lastName, or email',
                    limit: 'integer 1–100 (default 20)',
                    offset: 'integer ≥ 0 (default 0)',
                    minAge: 'integer ≥ 0',
                    maxAge: 'integer ≥ 0',
                    jobTitle: 'string — partial match',
                    city: 'string — partial match',
                    isActive: 'true | false',
                },
            },
            timestamp: new Date().toISOString(),
        });
    }

    // ------------------------------------------------------------------
    // 404 — unknown route
    // ------------------------------------------------------------------
    return sendError(res, 404, `Route "${pathname}" not found.`);
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
    try {
        handleRequest(req, res);
    } catch (err) {
        console.error('Unhandled error:', err);
        // Guard against double-write if headers were already sent
        if (!res.headersSent) {
            sendError(res, 500, 'An unexpected internal server error occurred.');
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
