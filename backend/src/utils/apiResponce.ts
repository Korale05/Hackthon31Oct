
class ApiResponse {
    private statusCode;
    private data : any;
    private message : string;
    private success;
    constructor(statusCode : number, data : any, message = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}

export { ApiResponse };