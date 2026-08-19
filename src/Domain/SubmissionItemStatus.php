<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

enum SubmissionItemStatus: string
{
    case AtLab = 'at_lab';
    case Returned = 'returned';
    case PickedUp = 'picked_up';
    case Cancelled = 'cancelled';
}
