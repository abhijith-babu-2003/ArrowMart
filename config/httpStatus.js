const HttpStatus = Object.freeze({
    // Success responses (2xx)
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,

    
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,

    // Server error responses (5xx)
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503
});

module.exports = HttpStatus;