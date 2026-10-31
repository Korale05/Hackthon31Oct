
class ApiError extends Error {
    private success;
    public statuscode;
    private data : any;
    private errors;
    constructor(
        statusCode : number,
        message = "Something went wrong!",
        errors = [],
        stack = ""
    ) {
        super(message);

        this.statuscode = statusCode;
        this.success = false;
        this.data = null;
        this.errors = errors;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError };