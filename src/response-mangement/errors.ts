export class ResponseManagementError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ResponseManagementError";
    }
}

export class ResponseValidationError extends ResponseManagementError {
    constructor(message: string) {
        super(message);
        this.name = "ResponseValidationError";
    }
}

export class InvalidStatusCodeError extends ResponseManagementError {
    constructor(status: number) {
        super(`Invalid HTTP status code: ${status}`);
        this.name = "InvalidStatusCodeError";
    }
}

export class ResponseAlreadySentError extends ResponseManagementError {
    constructor() {
        super("Response has already been sent");
        this.name = "ResponseAlreadySentError";
    }
}

export class BodylessStatusError extends ResponseManagementError {
    constructor(status: number) {
        super(`${status} responses cannot include a body`);
        this.name = "BodylessStatusError";
    }
}
