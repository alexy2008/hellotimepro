<?php

namespace App\Exceptions;

use RuntimeException;

class LlmException extends RuntimeException
{
    public function __construct(string $message, public int $status = 0)
    {
        parent::__construct($message);
    }
}
