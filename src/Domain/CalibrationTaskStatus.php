<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

enum CalibrationTaskStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
}
