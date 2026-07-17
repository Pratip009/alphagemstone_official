import { NextRequest } from 'next/server';
import { withAdmin } from '@/middleware/auth.middleware';
import { successResponse, errorResponse } from '@/lib/api-response';
import { adminListEligibilityApplications } from '@/services/memo.service';

export const GET = withAdmin(async (_req: NextRequest) => {
  try {
    const applications = await adminListEligibilityApplications();
    return successResponse(applications, 200);
  } catch (err) {
    console.error('GET /api/admin/memo-eligibility error:', err);
    return errorResponse('Failed to fetch applications', 500);
  }
});
