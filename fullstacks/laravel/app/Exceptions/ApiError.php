<?php

namespace App\Exceptions;

use Exception;

class ApiError extends Exception
{
    public function __construct(
        public int $status,
        public string $errorCode,
        string $message,
        public array $details = [],
    ) {
        parent::__construct($message);
    }
}
