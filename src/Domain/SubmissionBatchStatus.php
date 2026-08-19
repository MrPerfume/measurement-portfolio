<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

enum SubmissionBatchStatus: string
{
    case AtLab = 'at_lab';
    case Returned = 'returned';
    case Closed = 'closed';
}
